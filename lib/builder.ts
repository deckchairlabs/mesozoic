import {
  crayon,
  createGraph,
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
import type { GlobToRegExpOptions, ImportMap, Target } from "./types.ts";
import { vendorModuleGraph } from "./vendor.ts";
import { compile } from "./compiler.ts";
// import { cssProcessor } from "./processor/css.ts";
import { isLocalSpecifier, isRemoteSpecifier } from "./graph/specifiers.ts";
import { createLoader, wrapLoaderWithLogging } from "./graph/load.ts";
import {
  BareSpecifiersMap,
  createResolver,
  resolverCache,
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
 * An object where the keys are the name of the entrypoint
 */
export type BuilderEntrypoints = {
  [name: string]: EntrypointConfig;
};

export type BuildResult = {
  importMap: ImportMap;
  vendored: FileBag;
};

export class Builder {
  public importMap: ImportMap = {
    imports: {},
    scopes: {},
  };

  public log: Logger;
  public entrypoints: Map<string, Entrypoint> = new Map();

  public ignored: RegExp[] = [];
  public dynamicImportIgnored: RegExp[] = [];
  public hashed: RegExp[] = [];
  public compiled: RegExp[] = [];

  // public moduleGraphs: Map<string, ModuleGraph> = new Map();
  public importMaps: Map<string, ImportMap> = new Map();

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

  addEntrypoint(name: string, config: EntrypointConfig) {
    if (this.entrypoints.has(name)) {
      throw new Error(
        sprintf('There is already an entrypoint named "%s"', name),
      );
    }

    const { path } = config;

    this.entrypoints.set(
      name,
      new Entrypoint(name, config, path, this.context.root),
    );
  }

  setEntrypoints(entrypoints: BuilderEntrypoints) {
    Object.entries(entrypoints).forEach(([name, config]) =>
      this.addEntrypoint(name, config)
    );
  }

  getEntrypoint(name: string) {
    return this.entrypoints.get(name);
  }

  getImportMap(name: string): ImportMap {
    if (!this.importMaps.has(name)) {
      throw new Error(
        sprintf('No importMap was found for entrypoint "%s".', name),
      );
    }

    return this.importMaps.get(name)!;
  }

  // getModuleGraph(name: string): ModuleGraph {
  //   if (!this.moduleGraphs.has(name)) {
  //     throw new Error(
  //       sprintf('No moduleGraph was found for entrypoint "%s".', name),
  //     );
  //   }

  //   return this.moduleGraphs.get(name)!;
  // }

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

  async build(buildSources: FileBag) {
    try {
      /**
       * Copy source files to the output directory
       */
      const sources = await buildSources.filter((source) =>
        !this.isIgnored(source)
      ).copyTo(
        this.context.output,
      );

      const buildResults: Map<string, BuildResult> = new Map();

      /**
       * Create a module graph for each entrypoint and vendor the dependencies
       */
      for (const sourceEntrypoint of this.entrypoints.values()) {
        const entrypoint = sources.find((source) =>
          source.relativePath() === sourceEntrypoint.relativePath()
        );

        if (!entrypoint) {
          throw new Error(
            sprintf(
              'Could not find entrypoint "%s" in output directory',
              sourceEntrypoint.name,
            ),
          );
        }

        const path = entrypoint.relativePath();
        const loggedPath = crayon.lightBlue(path);

        const bareSpecifiers: BareSpecifiersMap = new Map();
        const entrypointName = sourceEntrypoint.name;
        const entrypointTarget = sourceEntrypoint.config!.target;

        const vendorOutputDir = join(
          this.context.output,
          "vendor",
          entrypointName,
        );

        const resolver = wrapResolverWithLogging(
          createResolver({
            importMap: this.importMap,
            sources,
            bareSpecifiers,
            baseURL: toFileUrl(this.context.root),
          }),
          this.log,
        );

        const loader = wrapLoaderWithLogging(
          createLoader({
            sources,
            target: entrypointTarget,
            dynamicImportIgnored: this.dynamicImportIgnored,
          }),
          this.log,
        );

        this.log.info(
          sprintf(
            "Building module graph for entrypoint %s",
            loggedPath,
          ),
        );

        const graph = await createGraph(String(entrypoint.url()), {
          kind: "codeOnly",
          defaultJsxImportSource: this.context.compiler?.jsxImportSource ||
            "react",
          resolve: resolver,
          load: loader,
        });

        const remoteModules = graph.modules.filter((module) =>
          isRemoteSpecifier(module.specifier)
        );

        const localModules = graph.modules.filter((module) =>
          isLocalSpecifier(module.specifier)
        );

        const remoteSources = FileBag.fromModules(
          remoteModules,
          vendorOutputDir,
        );

        const localSources = FileBag.fromModules(
          localModules,
          this.context.output,
        );

        this.log.debug(
          sprintf(
            `Total modules: local %d, remote %d`,
            localSources.size,
            remoteSources.size,
          ),
        );

        this.log.success("Module graph built");

        /**
         * Vendor modules for each entrypoint
         */
        this.log.info(
          sprintf("Vendor modules for entrypoint %s", loggedPath),
        );

        const [vendorSources, importMap] = vendorModuleGraph(graph, {
          name: entrypointName,
          output: this.context.output,
          sources,
          bareSpecifiers,
        });

        const vendored = await vendorSources.copyTo(this.context.output);

        this.importMaps.set(entrypointName, importMap);

        this.log.success(
          sprintf(
            "Vendored %d modules for entrypoint %s",
            vendored.size,
            loggedPath,
          ),
        );

        buildResults.set(entrypointName, {
          importMap,
          vendored,
        });
      }

      const outputSources = await FileBag.from(this.context.output);

      /**
       * Compile the output sources
       */
      const compiledSources = await this.compileSources(
        outputSources.filter((source) => this.isCompilable(source)),
        "browser",
      );

      /**
       * Content-hash the output sources
       */
      const contentHashedSources = await this.hashSources(
        (await FileBag.from(this.context.output)).filter((
          source,
        ) => this.isHashable(source)),
      );

      console.log(contentHashedSources);

      this.#cleanup();

      return buildResults;
    } catch (error) {
      throw error;
    }
  }

  #cleanup() {
    resolverCache.clear();
  }

  /**
   * Walk the root for SourceFiles obeying exclusion patterns
   */
  gatherSources(from: string = this.context.root) {
    return FileBag.from(from);
  }

  async cleanOutput() {
    try {
      await Deno.remove(this.context.output, { recursive: true });
    } catch (_error) {
      // whatever
    }
  }

  copySources(
    sources: FileBag,
    destination: string = this.context.output,
  ) {
    const sourcesToCopy = sources.filter((source) => !this.isIgnored(source));
    const result = sourcesToCopy.copyTo(destination);

    return result;
  }

  copySource(source: IFile, destination: string = this.context.output) {
    if (!this.isIgnored(source)) {
      return source.copyTo(destination);
    }
  }

  async compileSources(
    sources: FileBag,
    target: Target | undefined,
  ) {
    const items: IFile[] = [];
    for (const source of sources.values()) {
      const compiledSource = await this.compileSource(source, target);
      items.push(compiledSource);
    }

    return new FileBag(items);
  }

  async compileSource(
    source: IFile,
    target: Target | undefined,
  ): Promise<IFile> {
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
    await source.write(compiled.code, true);

    return source;
  }

  /**
   * Returns a Map with the key being the original relative path
   * and the value being the content hashed relative path.
   */
  async hashSources(sources: FileBag, mappings?: Map<string, string>) {
    const items: IFile[] = [];

    for (const source of sources.values()) {
      const contentHash = await source.contentHash();
      const extension = source.extension();

      const originalPath = source.relativePath();
      const filename = source.filename().replace(
        extension,
        `.${contentHash}${extension}`,
      );

      await source.rename(filename);
      mappings?.set(originalPath, source.relativePath());
      items.push(source);
    }

    return new FileBag(items);
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
      const relativePath = source.relativePath();
      const isIgnored = ignored.some((pattern) => pattern.test(relativePath));
      if (!isIgnored) {
        json.push([
          relativePath,
          prefix ? resolve(prefix, relativePath) : source.path(),
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
