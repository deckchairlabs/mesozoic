import {
  createGraph,
  globToRegExp,
  join,
  resolve,
  sprintf,
  walk,
} from "./deps.ts";
import { ISource } from "./source.ts";
import { SourceFileBag } from "./sourceFileBag.ts";
import { SourceFile } from "./sourceFile.ts";

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
  sources: SourceFileBag;
  compiled: SourceFileBag;
};

export abstract class AbstractBuilder {
  private hasCopied = false;
  private isValid = false;

  public entrypoints: RegExp[];
  public exclude: RegExp[];
  public hash: RegExp[];
  public compile: RegExp[];
  public manifestExclude: RegExp[];

  /**
   * @param context
   */
  constructor(public readonly context: BuildContext) {
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

  async build(sources: SourceFileBag): Promise<BuildResult> {
    this.#valid();

    /**
     * Gather compilable sources and compile them
     */
    try {
      const compilable = sources.filter((source) => this.isCompilable(source));
      const compiled = await this.compileSources(compilable);

      /**
       * Get the entrypoints
       */
      const entrypoints = await compiled.filter((source) =>
        this.isEntrypoint(source)
      );

      /**
       * Create the module graph for the entrypoints
       */
      await this.buildModuleGraph(entrypoints);

      return {
        sources,
        compiled,
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
    const sources = new SourceFileBag();

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

  async vendorSources(sources: SourceFileBag, output = "") {
    const outputPath = join(this.context.output, "vendor", output);
    const paths: string[] = [];

    for (const source of sources.values()) {
      paths.push(source.path());
    }

    const cmd = [
      Deno.execPath(),
      "vendor",
      "--force",
      "--output",
      outputPath,
      ...paths,
    ];

    const vendor = Deno.run({
      cwd: this.context.output,
      cmd: cmd,
      stdout: "piped",
      stderr: "piped",
    });

    const [status, stderr] = await Promise.all([
      vendor.status(),
      vendor.output(),
      vendor.stderrOutput(),
    ]);

    vendor.close();

    if (status.code === 0) {
      return this.gatherSources(outputPath);
    } else {
      const error = new TextDecoder().decode(stderr);
      console.error(error);
      throw new Error(error);
    }
  }

  async copySources(
    sources: SourceFileBag,
    destination: string = this.context.output,
  ) {
    const result: SourceFileBag = new SourceFileBag();

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

  async copySource(source: ISource, destination: string) {
    if (!this.isIgnored(source)) {
      let copied: ISource;
      if (this.isHashable(source)) {
        copied = await source.copyToHashed(destination);
      } else {
        copied = await source.copyTo(destination);
      }

      return copied;
    }
  }

  async compileSources(sources: SourceFileBag) {
    this.#valid();

    for (const source of sources.values()) {
      await this.compileSource(source);
    }

    return sources;
  }

  async compileSource(source: ISource): Promise<ISource> {
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
    sources: SourceFileBag,
    processor: (source: ISource) => Promise<ISource> | ISource,
  ) {
    this.#valid();
    return Promise.all(sources.toArray().map((source) => processor(source)));
  }

  async buildModuleGraph(sources: SourceFileBag) {
    for (const source of sources.values()) {
      const graph = await createGraph(source.url().href, {
        kind: "codeOnly",
        defaultJsxImportSource: "react",
        load(_specifier) {
          return Promise.resolve(undefined);
        },
      });
      graph.free();
    }
  }

  isEntrypoint(source: ISource, aliased = true): boolean {
    const alias = source.relativeAlias();
    const path = (alias && aliased) ? alias : source.relativePath();

    return this.entrypoints.some((pattern) => pattern.test(path));
  }

  isIgnored(source: ISource): boolean {
    return this.exclude.some((pattern) => pattern.test(source.relativePath()));
  }

  isCompilable(source: ISource): boolean {
    return this.compile.some((pattern) => pattern.test(source.relativePath()));
  }

  isHashable(source: ISource): boolean {
    return this.hash.some((pattern) => pattern.test(source.relativePath()));
  }

  isManifestExcluded(source: ISource): boolean {
    return this.manifestExclude.some((pattern) =>
      pattern.test(source.relativePath())
    );
  }

  /**
   * @param prefix
   * @returns
   */
  toManifest(sources: SourceFileBag, prefix?: string) {
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
