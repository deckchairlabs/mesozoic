import { compile, CompilerOptions } from "./compiler.ts";
import { BuildContext } from "./context.ts";
import { createGraph } from "./graph.ts";
import { crayon, join, log, sprintf, toFileUrl } from "./deps.ts";
import { Entrypoint, EntrypointConfig } from "./entrypoint.ts";
import { createLoader, wrapLoaderWithLogging } from "./graph/load.ts";
import {
  BareSpecifiersMap,
  createResolver,
  resolverCache,
  wrapResolverWithLogging,
} from "./graph/resolve.ts";
import { isLocalSpecifier, isRemoteSpecifier } from "./graph/specifiers.ts";
import { Logger, type LoggerImpl } from "./logger.ts";
import { Patterns } from "./patterns.ts";
import { createCssProcessor, type CssProcessorOptions } from "./processor/css.ts";
import { IFile } from "./sources/file.ts";
import { FileBag } from "./sources/fileBag.ts";
import type { ImportMap, SpecifierMap, Target } from "./types.ts";
import { vendorModuleGraph } from "./vendor.ts";
import { createImportMapFromModuleGraph } from "./importMap.ts";

/**
 * An object where the keys are the name of the entrypoint
 */
export type BuilderEntrypoints = {
  [name: string]: EntrypointConfig;
};

export type BuilderOptions = {
  name?: string;
  logLevel?: log.LevelName;
  compilerOptions?: Omit<CompilerOptions, "filename">;
  cssOptions?: CssProcessorOptions;
};

export type BuildResult = {
  outputSources: FileBag;
  dynamicImports: FileBag;
  importMaps: Map<string, ImportMap>;
};

export class Builder {
  public importMap: ImportMap = {
    imports: {},
    scopes: {},
  };

  public log: LoggerImpl;
  public entrypoints: Map<string, Entrypoint> = new Map();

  constructor(
    public readonly context: BuildContext,
    public readonly options: BuilderOptions = {},
  ) {
    const { name = "mesozoic", logLevel = "INFO" } = options;
    this.log = new Logger(logLevel, name);

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
    Object.entries(entrypoints).forEach(([name, config]) => this.addEntrypoint(name, config));
  }

  getEntrypoint(name: string) {
    return this.entrypoints.get(name);
  }

  isCompilable(source: IFile): boolean {
    return this.context.compiled.test(source.relativePath());
  }

  isHashable(source: IFile): boolean {
    return this.context.hashed.test(source.relativePath());
  }

  isIgnored(source: IFile): boolean {
    return this.context.ignored.test(source.relativePath());
  }

  isDynamicImportSpecifierIgnored(specifier: string) {
    return this.context.dynamicImportIgnored.test(specifier);
  }

  async build(buildSources: FileBag): Promise<BuildResult> {
    /**
     * Build the patterns
     */
    this.context.ignored.build();
    this.context.dynamicImportIgnored.build();
    this.context.compiled.build();
    this.context.hashed.build();

    try {
      /**
       * Copy source files to the output directory
       */
      const sources = await buildSources.filter((source) => !this.isIgnored(source)).copyTo(
        this.context.output,
      );

      const importMaps: Map<string, ImportMap> = new Map();
      const dynamicImportSources = new FileBag();

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
          this.context.vendorPath,
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
            dynamicImportIgnored: this.context.dynamicImportIgnored,
            dynamicImports: dynamicImportSources,
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
          defaultJsxImportSource: this.options.compilerOptions?.jsxImportSource ||
            "react",
          resolve: resolver,
          load: loader,
        });

        const remoteModules = graph.modules.filter((module) => isRemoteSpecifier(module.specifier));

        const localModules = graph.modules.filter((module) => isLocalSpecifier(module.specifier));

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
        if (this.context.vendorDependencies) {
          this.log.info(
            sprintf("Vendor modules for entrypoint %s", loggedPath),
          );

          const vendoredSources = vendorModuleGraph(graph, {
            name: entrypointName,
            output: this.context.output,
            vendorPath: this.context.vendorPath,
          });

          await vendoredSources.copyTo(this.context.output);

          this.log.success(
            sprintf(
              "Vendored %d modules for entrypoint %s",
              vendoredSources.size,
              loggedPath,
            ),
          );
        }

        const vendorPathPrefix = this.context.vendorDependencies
          ? `./${this.context.vendorPath}/${entrypointName}`
          : null;

        const importMap: ImportMap = createImportMapFromModuleGraph(
          graph,
          { sources, bareSpecifiers, vendorPathPrefix },
        );

        importMaps.set(entrypointName, importMap);
        resolverCache.clear();
      }

      const outputSources = await FileBag.from(this.context.output);

      /**
       * Compile the output sources
       */
      this.log.info("Compiling sources");
      const compiled = await this.compileSources(outputSources);
      this.log.success(sprintf("Compiled %d sources", compiled.size));

      /**
       * Content-hash the output sources
       */
      await this.hashSources(
        outputSources.filter((
          source,
        ) => this.isHashable(source)),
      );

      const remappedPaths = outputSources.remappedPaths();

      /**
       * Re-map the importMap resolved specifiers
       */
      for (const [entrypointName, importMap] of importMaps.entries()) {
        const entrypoint = this.getEntrypoint(entrypointName);
        if (entrypoint) {
          const remappedImportMap = this.#remapImportMapImports(
            importMap,
            remappedPaths,
            entrypoint.config.target,
          );

          importMaps.set(entrypointName, remappedImportMap);
        }
      }

      /**
       * Process sources
       */
      this.log.info(`Optimizing CSS sources`);
      const cssProcessor = await createCssProcessor(this.options.cssOptions);
      const cssSources = await cssProcessor(outputSources);
      this.log.success(sprintf(`Optimized %d CSS sources`, cssSources.size));

      return {
        outputSources,
        dynamicImports: dynamicImportSources,
        importMaps,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Walk the root for SourceFiles
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
  ) {
    const compiled = new FileBag();
    const compileable = sources.filter((source) => this.isCompilable(source));

    for (const source of compileable.values()) {
      const output = await this.compileSource(source);
      compiled.add(output);
    }

    return compiled;
  }

  async compileSource(
    source: IFile,
  ): Promise<IFile> {
    const content = await source.read();

    const compiled = await compile(source.path(), content, {
      development: false,
      ...this.options.compilerOptions,
    });

    const extension = source.extension();
    const filename = source.filename().replace(extension, ".js");
    await source.rename(filename);
    await source.write(compiled, true);

    return source;
  }

  /**
   * Returns a Map with the key being the original relative path
   * and the value being the content hashed relative path.
   */
  async hashSources(sources: FileBag) {
    const items: IFile[] = [];

    for (const source of sources.values()) {
      const contentHash = await source.contentHash();
      const extension = source.extension();
      const filename = source.filename().replace(
        extension,
        `.${contentHash}${extension}`,
      );

      await source.rename(filename);
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

    const ignored = new Patterns(ignore);
    ignored.build();

    for (const source of sources.values()) {
      const originalPath = source.originalPath().relativePath();
      const relativePath = source.relativePath();
      const isIgnored = ignored.test(relativePath);

      if (!isIgnored && (relativePath !== originalPath)) {
        json.push([
          originalPath,
          prefix ? relativePath.replace("./", prefix) : relativePath,
        ]);
      }
    }

    return json;
  }

  #remapImportMapImports(
    importMap: ImportMap,
    remappedImports: Map<string, string>,
    target: Target,
  ): ImportMap {
    const remappedImportMap: ImportMap = {
      imports: importMap.imports,
      scopes: importMap.scopes,
    };

    if (remappedImportMap.imports) {
      for (const [specifier, resolved] of Object.entries(remappedImportMap.imports)) {
        remappedImportMap.imports[specifier] = remappedImports.get(specifier) ||
          remappedImports.get(resolved) ||
          resolved;
      }
    }

    function remapBrowserSpecifierMap(specifierMap: SpecifierMap) {
      for (const [specifier, resolved] of Object.entries(specifierMap)) {
        specifierMap[specifier] = resolved.replace("./", "/");
      }
      return specifierMap;
    }

    if (target === "browser") {
      if (remappedImportMap.imports) {
        remappedImportMap.imports = remapBrowserSpecifierMap(remappedImportMap.imports);
      }

      if (remappedImportMap.scopes) {
        remappedImportMap.scopes = Object.fromEntries(
          Object.entries(remappedImportMap.scopes).map(([scope, specifierMap]) => {
            return [scope.replace("./", "/"), remapBrowserSpecifierMap(specifierMap)];
          }),
        );
      }
    }

    return remappedImportMap;
  }
}
