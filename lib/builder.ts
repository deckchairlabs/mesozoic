import {
  crayon,
  globToRegExp,
  join,
  log,
  resolve,
  sprintf,
  toFileUrl,
} from "./deps.ts";
import { IFile } from "./sources/file.ts";
import { FileBag } from "./sources/fileBag.ts";
import { Logger } from "./logger.ts";
import { Entrypoint, EntrypointConfig } from "./entrypoint.ts";
import type {
  GlobToRegExpOptions,
  ImportMap,
  ModuleGraph,
  Target,
} from "./types.ts";
import { vendorModuleGraph } from "./vendor.ts";
import { gatherSources } from "./sources/gatherSources.ts";
import { cssProcessor } from "./processor/css.ts";
import { createGraph } from "./graph/createGraph.ts";
import { isRemoteSpecifier } from "./graph/specifiers.ts";
import { createLoader, wrapLoaderWithLogging } from "./graph/load.ts";
import {
  BareSpecifiersMap,
  createResolver,
  wrapResolverWithLogging,
} from "./graph/resolve.ts";

export type BuildContext = {
  /**
   * Absolute path to the project root directory.
   */
  root: string;
  /**
   * Absolute path to the ourput directory.
   */
  output: string;
  /**
   * Relative path to your importMap from root.
   */
  importMapPath: string;

  /**
   * The kind of module graph to build
   * @default "codeOnly"
   */
  graphKind?: "codeOnly" | "all";

  compiler?: {
    minify?: boolean;
    sourceMaps?: boolean;
    jsxImportSource?: string;
  };

  /**
   * Give your build system a custom name. Used as logging prefix.
   * @default "mesozoic"
   */
  name?: string;
  /**
   * Customise the logging level
   * @default "INFO"
   */
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

  public ignored: RegExp[] = [];
  public dynamicImportIgnored: RegExp[] = [];
  public hashed: RegExp[] = [];
  public compiled: RegExp[] = [];

  public moduleGraphs: Map<Entrypoint, ModuleGraph> = new Map();
  public importMaps: Map<Entrypoint, ImportMap> = new Map();

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
        join(this.context.root, this.context.importMapPath),
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

  /**
   * Allows ignoring certain files from the build process, they won't be copied
   * to the build output directory, so no further processing will occur on them.
   *
   * @param paths an array of relative paths to exclude from the build process.
   */
  setIgnored(paths: string[]) {
    this.ignored = this.#buildPatterns([
      ...paths,
      this.context.output,
    ]);
  }

  isIgnored(source: IFile): boolean {
    return this.ignored.some((pattern) => pattern.test(source.relativePath()));
  }

  setDynamicImportIgnored(paths: string[]) {
    this.dynamicImportIgnored = this.#buildPatterns(paths);
  }

  isDynamicImportSpecifierIgnored(specifier: string) {
    return this.dynamicImportIgnored.some((pattern) => pattern.test(specifier));
  }

  async build(sources: FileBag): Promise<BuildResult> {
    this.#valid();

    /**
     * Gather compilable sources and compile them
     */
    try {
      // const compilable = sources.filter((source) => this.isCompilable(source));
      // const compiled = await this.compileSources(compilable);

      // /**
      //  * Process css files
      //  */
      // await cssProcessor(sources);

      /**
       * Get the entrypoint source files
       */
      const entrypoints = Array.from(
        sources.filter((source) => this.isEntrypoint(source)),
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
        !isRemoteSpecifier(String(source.url()))
      );

      /**
       * Create the module graph for each entrypoint
       */
      for (const entrypoint of entrypoints.values()) {
        const path = entrypoint.relativeAlias() ?? entrypoint.relativePath();

        this.log.info(
          sprintf(
            'Building "%s" module graph for entrypoint %s',
            crayon.lightBlue(entrypoint.config!.target),
            path,
          ),
        );

        const bareSpecifiers: BareSpecifiersMap = new Map();
        const target = entrypoint.config!.target;

        const resolver = wrapResolverWithLogging(
          createResolver({
            importMap: this.importMap,
            sources: localSources,
            bareSpecifiers,
            baseURL: toFileUrl(this.context.root),
          }),
          this.log,
        );

        const loader = wrapLoaderWithLogging(
          createLoader({
            sources: localSources,
            target,
            dynamicImportIgnored: this.dynamicImportIgnored,
          }),
          this.log,
        );

        const graph = await createGraph(
          String(entrypoint),
          loader,
          resolver,
          "codeOnly",
          this.context.compiler?.jsxImportSource,
        );

        this.log.success("Module graph built");

        /**
         * Vendor modules for each entrypoint
         */
        this.log.info(sprintf("Vendor modules for entrypoint %s", path));

        const importMap = vendorModuleGraph(
          this,
          graph,
          localSources,
          {
            outputDir: entrypoint.config?.vendorOutputDir,
          },
        );

        this.moduleGraphs.set(entrypoint, graph);
        this.importMaps.set(entrypoint, importMap);

        this.log.success(
          sprintf("Vendored modules for entrypoint %s", path),
        );
      }

      return {
        sources,
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
  gatherSources(from: string = this.context.root) {
    return gatherSources(from);
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

  copySource(source: IFile, destination: string = this.context.output) {
    if (!this.isIgnored(source)) {
      return source.copyTo(destination);
    }
  }

  async compileSources(sources: FileBag, target: Target | undefined) {
    this.#valid();

    const compiled = new FileBag();

    for (const source of sources.values()) {
      const originalSource = source.clone();
      const compiledSource = await this.compileSource(source, target);

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

  async compileSource(
    source: IFile,
    target: Target | undefined,
  ): Promise<IFile> {
    const { compile } = await import("./compiler.ts");

    if (!this.isCompilable(source)) {
      return source;
    }

    const content = await source.read();

    const compiled = await compile(content, {
      filename: source.path(),
      target,
      development: false,
      minify: this.context?.compiler?.minify,
      sourceMaps: this.context?.compiler?.sourceMaps,
      jsxImportSource: this.context?.compiler?.jsxImportSource,
    });

    const extension = source.extension();
    const filename = source.filename().replace(extension, ".js");
    await source.rename(filename);

    await source.write(compiled.code);

    return source;
  }

  toManifest(
    sources: FileBag,
    { ignore = [], prefix }:
      | { ignore?: string[]; prefix?: string }
      | undefined = {},
  ) {
    const json = [];

    const ignored = this.#buildPatterns(ignore);

    for (const source of sources.values()) {
      const isIgnored = ignored.some((pattern) =>
        pattern.test(source.relativePath())
      );
      if (!isIgnored) {
        json.push([
          source.relativeAlias() ?? source.relativePath(),
          prefix ? resolve(prefix, source.relativePath()) : source.path(),
        ]);
      }
    }

    return json;
  }

  globToRegExp(pattern: string, options: GlobToRegExpOptions = {
    extended: true,
    globstar: true,
    caseInsensitive: false,
  }) {
    return globToRegExp(pattern, options);
  }

  #buildPatterns(patterns?: string[]) {
    if (!patterns) {
      return [];
    }

    return patterns.map((pattern) => this.globToRegExp(pattern));
  }
}
