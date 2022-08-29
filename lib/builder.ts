import { globToRegExp, join, log, resolve, sprintf, walk } from "./deps.ts";
import { IFile } from "./file.ts";
import { FileBag } from "./fileBag.ts";
import { buildModuleGraph } from "./graph.ts";
import { Logger } from "./logger.ts";
import { SourceFile } from "./sourceFile.ts";
import { Entrypoint, EntrypointConfig } from "./entrypointFile.ts";
import type { ImportMap } from "./types.ts";
import { isRemoteSpecifier } from "./utils.ts";
import { vendorEntrypoint } from "./vendor.ts";

export type BuildContext = {
  root: string;
  output: string;
  importMap: string;
  compiler?: {
    minify?: boolean;
    sourceMaps?: boolean;
  };
  name?: string;
  logLevel?: log.LevelName;
};

/**
 * An object where the keys are a path of an entrypoint
 * relative to the {@link BuildContext.root}
 */
export type BuilderEntrypoints = {
  [path: string]: EntrypointConfig;
};

export type BuildResult = {
  sources: FileBag;
  compiled: FileBag;
  entrypoints: Entrypoint[];
};

export class Builder {
  private hasCopied = false;
  private isValid = false;

  public importMap: ImportMap = {
    imports: {},
    scopes: {},
  };

  public log: Logger;
  public entrypoints: Map<string, EntrypointConfig> = new Map();

  public excluded: RegExp[] = [];
  public hashed: RegExp[] = [];
  public compiled: RegExp[] = [];

  constructor(public readonly context: BuildContext) {
    this.log = new Logger(context?.logLevel || "INFO", context?.name);

    if (this.context.root.startsWith(".")) {
      throw new Error("root must be an absolute path");
    }
    if (this.context.output.startsWith(".")) {
      throw new Error("output must be an absolute path");
    }

    this.importMap = JSON.parse(
      Deno.readTextFileSync(
        join(this.context.root, this.context.importMap),
      ),
    );
  }

  setEntrypoints(entrypoints: BuilderEntrypoints) {
    this.entrypoints = new Map(Object.entries(entrypoints));
  }

  getEntrypoint(path: string) {
    return this.entrypoints.get(path);
  }

  isEntrypoint(source: IFile): boolean {
    const alias = source.relativeAlias();
    const path = alias ?? source.relativePath();

    return this.entrypoints.has(path);
  }

  setCompiled(paths: string[]) {
    this.compiled = this.#buildPatterns(paths);
  }

  isCompilable(source: IFile): boolean {
    return this.compiled.some((pattern) => pattern.test(source.relativePath()));
  }

  setHashed(paths: string[]) {
    this.hashed = this.#buildPatterns(paths);
  }

  isHashable(source: IFile): boolean {
    return this.hashed.some((pattern) => pattern.test(source.relativePath()));
  }

  setExcluded(paths: string[]) {
    this.excluded = this.#buildPatterns([
      ...paths,
      this.context.output,
    ]);
  }

  isExcluded(source: IFile): boolean {
    return this.excluded.some((pattern) => pattern.test(source.relativePath()));
  }

  async build(sources: FileBag): Promise<BuildResult> {
    this.#valid();

    /**
     * Gather compilable sources and compile them
     */
    try {
      const compilable = sources.filter((source) => this.isCompilable(source));
      const compiled = await this.compileSources(compilable);

      /**
       * Get the entrypoint source files
       */
      const entrypoints = Array.from(
        compiled.filter((source) => this.isEntrypoint(source)),
      ).map((source) => {
        const config = this.getEntrypoint(
          source.relativeAlias() ||
            source.relativePath(),
        );
        return new Entrypoint(
          source.path(),
          source.root(),
          config,
        );
      });

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
        this.log.info(sprintf("Building module graph for entrypoint %s", path));

        const graph = await buildModuleGraph(
          this,
          localSources,
          entrypoint,
        );

        entrypoint.setModuleGraph(graph);

        this.log.success("Module graph built");

        /**
         * Vendor modules for each entrypoint
         */
        this.log.info(sprintf("Vendor modules for entrypoint %s", path));

        await vendorEntrypoint(
          this,
          entrypoint,
          localSources,
        );

        // const copied = await this.copySources(vendored, outputDir);
        // vendoredSources = vendoredSources.merge(copied);

        this.log.success(
          sprintf("Vendored modules for entrypoint %s", path),
        );
      }

      return {
        sources,
        compiled,
        entrypoints,
      };
    } catch (error) {
      throw error;
    }
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
    } catch (_error) {
      // whatever
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

  async copySource(source: IFile, destination: string = this.context.output) {
    if (!this.isExcluded(source)) {
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

    const compiled = new FileBag();

    for (const source of sources.values()) {
      const originalSource = source.clone();
      const compiledSource = await this.compileSource(source);

      /**
       * If we compiled an entrypoint, we update that entrypoint
       * to point to the new compiled relative path.
       */
      if (this.isEntrypoint(originalSource)) {
        const path = originalSource.relativePath();
        const config = this.entrypoints.get(originalSource.relativePath());

        this.entrypoints.delete(path);
        this.entrypoints.set(source.relativePath(), config!);
      }
      compiled.add(compiledSource);
    }

    return compiled;
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

    const extension = source.extension();
    const filename = source.filename().replace(extension, ".js");

    await source.rename(filename);
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

  toManifest(
    sources: FileBag,
    { exclude = [], prefix }:
      | { exclude?: string[]; prefix?: string }
      | undefined = {},
  ) {
    const json = [];

    const excluded = this.#buildPatterns(exclude);

    for (const source of sources.values()) {
      const isExcluded = excluded.some((pattern) =>
        pattern.test(source.relativePath())
      );
      if (!isExcluded) {
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
