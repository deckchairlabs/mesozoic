import {
  globToRegExp,
  log,
  resolve,
  sprintf,
  toFileUrl,
  walk,
} from "./deps.ts";
import { IFile } from "./file.ts";
import { FileBag } from "./fileBag.ts";
import { buildModuleGraph } from "./graph.ts";
import { parseImportMap } from "./importMap.ts";
import { Logger } from "./logger.ts";
import { SourceFile } from "./sourceFile.ts";
import type { ImportMap } from "./types.ts";
import { isRemoteSpecifier } from "./utils.ts";
import { vendorRemoteModules } from "./vendor.ts";

export type BuildContext = {
  root: string;
  output: string;
  exclude?: string[];
  entrypoints?: BuilderEntrypoints;
  hashable?: string[];
  compilable?: string[];
  compiler?: {
    minify?: boolean;
    sourceMaps?: boolean;
  };
  manifest?: {
    exclude?: string[];
  };
  debug?: boolean;
};

export type BuilderEntrypointTarget = "browser" | "deno";
/**
 * An object where the keys are a path of an entrypoint
 * relative to the {@link BuildContext.root}
 */
export type BuilderEntrypoints = {
  [path: string]: BuilderEntrypoint;
};

export type BuilderEntrypoint = {
  /**
   * The output directory for the vendored dependencies
   * of this entrypoint, relative to the vendor output directory.
   */
  output: string;
  target: BuilderEntrypointTarget;
};

export type BuildResult = {
  // graph: ModuleGraph;
  sources: FileBag;
  compiled: FileBag;
};

export type BuilderOptions = {
  name?: string;
  logLevel?: log.LevelName;
};

export class Builder {
  private hasCopied = false;
  private isValid = false;
  private entrypointMap: Map<string, BuilderEntrypoint>;

  public log: Logger;
  public exclude: RegExp[];
  public hash: RegExp[];
  public compile: RegExp[];
  public manifestExclude: RegExp[];

  /**
   * @param context
   * @param options
   */
  constructor(
    public readonly context: BuildContext,
    public readonly options?: BuilderOptions,
  ) {
    this.log = new Logger(options?.logLevel || "INFO", options?.name);

    this.exclude = this.#buildPatterns(
      this.context?.exclude,
    );
    this.hash = this.#buildPatterns(
      this.context?.hashable,
    );
    this.compile = this.#buildPatterns(
      this.context?.compilable,
    );
    this.manifestExclude = this.#buildPatterns(
      this.context?.manifest?.exclude,
    );

    this.entrypointMap = new Map(
      Object.entries(this.context.entrypoints || {}),
    );
  }

  async build(sources: FileBag, importMap?: ImportMap): Promise<BuildResult> {
    this.#valid();

    /**
     * Gather compilable sources and compile them
     */
    try {
      const parsedImportMap = parseImportMap(
        importMap,
        toFileUrl(this.context.output),
      );
      const compilable = sources.filter((source) => this.isCompilable(source));
      const compiled = await this.compileSources(compilable);

      /**
       * Get the entrypoint source files
       */
      const entrypoints = sources.filter((source) => this.isEntrypoint(source));

      /**
       * Get all the local sources
       */
      const localSources = sources.filter((source) =>
        !isRemoteSpecifier(source.url())
      );

      /**
       * Create the module graph for each entrypoint
       */
      for (const entrypoint of entrypoints.values()) {
        const path = entrypoint.relativeAlias() ?? entrypoint.relativePath();
        this.log.info(sprintf("Building module graph fo entrypoint %s", path));

        const graph = await buildModuleGraph(
          this,
          entrypoint,
          localSources,
          parsedImportMap,
        );

        this.log.success("Module graph built");

        /**
         * Vendor remote modules for each entrypoint
         */
        this.log.info(sprintf("Vendor remote modules for entrypoint %s", path));

        const vendored = await vendorRemoteModules(
          this,
          graph,
          entrypoint,
          sources,
        );

        this.log.success(
          sprintf("Vendored modules for entrypoint %s", path),
        );
      }

      /**
       * Copy the vendored remotes
       */
      // await this.copySources(vendored);

      return {
        // graph,
        sources,
        compiled,
        // vendored,
      };
    } catch (error) {
      throw error;
    }
  }

  getEntrypoint(path: string) {
    return this.entrypointMap.get(path);
  }

  #valid() {
    if (this.isValid) {
      return;
    }

    if (!this.hasCopied) {
      throw new Error("must copy sources before performing a build.");
    }

    this.isValid = true;
  }

  /**
   * Walk the root for SourceFiles obeying exclusion patterns
   */
  async gatherSources(from: string = this.context.root) {
    const sources = new FileBag();

    for await (const entry of walk(from)) {
      if (entry.isFile) {
        const sourceFile = new SourceFile(entry.path, from);
        sources.add(sourceFile);
      }
    }

    return sources;
  }

  async cleanOutput() {
    try {
      await Deno.remove(this.context.output, { recursive: true });
    } catch (error) {
      throw error;
    }
  }

  async copySources(
    sources: FileBag,
    destination: string = this.context.output,
  ) {
    const result: FileBag = new FileBag();

    for (const source of sources.values()) {
      try {
        const copied = await this.copySource(source, destination);
        if (copied) {
          result.add(copied);
        }
      } catch (error) {
        throw error;
      }
    }

    this.hasCopied = true;

    return result;
  }

  async copySource(source: IFile, destination: string) {
    if (!this.isIgnored(source)) {
      let copied: IFile;
      if (this.isHashable(source)) {
        copied = await source.copyToHashed(destination);
      } else {
        copied = await source.copyTo(destination);
      }

      return copied;
    }
  }

  async compileSources(sources: FileBag) {
    this.#valid();

    for (const source of sources.values()) {
      await this.compileSource(source);
    }

    return sources;
  }

  async compileSource(source: IFile): Promise<IFile> {
    const { compile } = await import("./compiler.ts");

    if (!this.isCompilable(source)) {
      throw new Error(
        sprintf(
          "source is not compilable: %s",
          source.relativePath(),
        ),
      );
    }

    const content = await source.read();
    const compiled = await compile(content, {
      filename: source.path(),
      development: false,
      minify: this.context?.compiler?.minify,
      sourceMaps: this.context?.compiler?.sourceMaps,
    });

    await source.write(compiled.code);

    return source;
  }

  processSources(
    sources: FileBag,
    processor: (source: IFile) => Promise<IFile> | IFile,
  ) {
    this.#valid();
    return Promise.all(sources.toArray().map((source) => processor(source)));
  }

  isEntrypoint(source: IFile, aliased = true): boolean {
    const alias = source.relativeAlias();
    const path = (alias && aliased) ? alias : source.relativePath();

    const entrypoints = Object.keys(this.context.entrypoints || {});

    return entrypoints.some((entrypoint) => entrypoint === path);
  }

  isIgnored(source: IFile): boolean {
    return this.exclude.some((pattern) => pattern.test(source.relativePath()));
  }

  isCompilable(source: IFile): boolean {
    return this.compile.some((pattern) => pattern.test(source.relativePath()));
  }

  isHashable(source: IFile): boolean {
    return this.hash.some((pattern) => pattern.test(source.relativePath()));
  }

  isManifestExcluded(source: IFile): boolean {
    return this.manifestExclude.some((pattern) =>
      pattern.test(source.relativePath())
    );
  }

  /**
   * @param prefix
   * @returns
   */
  toManifest(sources: FileBag, prefix?: string) {
    const json = [];

    for (const source of sources.values()) {
      if (!this.isManifestExcluded(source)) {
        json.push([
          source.relativeAlias() ?? source.relativePath(),
          prefix ? resolve(prefix, source.relativePath()) : source.path(),
        ]);
      }
    }

    return json;
  }

  #buildPatterns(patterns?: string[]) {
    if (!patterns) {
      return [];
    }

    return patterns.map((pattern) => {
      return globToRegExp(pattern, {
        extended: true,
        globstar: true,
        caseInsensitive: false,
      });
    });
  }
}
