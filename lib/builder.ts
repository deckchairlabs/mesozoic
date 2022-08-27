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
import { ParsedImportMap, parseImportMap } from "./importMap.ts";
import { Logger } from "./logger.ts";
import { SourceFile } from "./sourceFile.ts";
import type { ImportMap, ModuleGraph } from "./types.ts";
import { vendorRemoteSources } from "./vendor.ts";

export type BuildContext = {
  root: string;
  output: string;
  exclude?: string[];
  entrypoints?: string[];
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

export type BuildResult = {
  graph: ModuleGraph;
  sources: FileBag;
  compiled: FileBag;
  // vendored: FileBag;
};

export type BuilderOptions = {
  name?: string;
  logLevel?: log.LevelName;
};

export class Builder {
  private hasCopied = false;
  private isValid = false;

  public log: Logger;
  public entrypoints: RegExp[];
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
    this.entrypoints = this.#buildPatterns(this.context?.entrypoints);
    this.hash = this.#buildPatterns(
      this.context?.hashable,
    );
    this.compile = this.#buildPatterns(
      this.context?.compilable,
    );
    this.manifestExclude = this.#buildPatterns(
      this.context?.manifest?.exclude,
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
       * Create the module graph
       */
      const graph = await this.buildModuleGraph(sources, parsedImportMap);
      // const vendored = await this.vendorRemoteSources(graph);

      /**
       * Copy the vendored remotes
       */
      // await this.copySources(vendored);

      return {
        graph,
        sources,
        compiled,
        // vendored,
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

    return this.entrypoints.some((pattern) => pattern.test(path));
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

  vendorRemoteSources(graph: ModuleGraph) {
    return vendorRemoteSources(graph, this.context.output);
  }

  buildModuleGraph(
    sources: FileBag,
    importMap?: ParsedImportMap,
  ): Promise<ModuleGraph> {
    this.log.info("Building module graph");
    return buildModuleGraph(this, sources, importMap);
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
