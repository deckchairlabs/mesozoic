import { globToRegExp, join, resolve, sprintf, walk } from "./deps.ts";
import { ISource } from "./source.ts";
import { SourceFileBag } from "./sourceFileBag.ts";
import { MesozoicLogger } from "./logger.ts";
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

export class Builder {
  private hasCopied = false;
  private isValid = false;

  public logger: MesozoicLogger;
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

    const debug = Boolean(Deno.env.get("MESOZOIC_DEBUG")) || context.debug;

    this.logger = new MesozoicLogger(debug ? "DEBUG" : "INFO");
    this.logger.context(this.context);
  }

  async build(sources: SourceFileBag): Promise<BuildResult> {
    this.#valid();

    this.logger.debug("Build starting");

    /**
     * Gather compilable sources and compile them
     */
    try {
      const compilable = sources.filter((source) => this.isCompilable(source));
      const compiled = await this.compileSources(compilable);

      this.logger.debug("Build complete");

      return {
        sources,
        compiled,
      };
    } catch (error) {
      this.logger.error(error);
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
    this.logger.debug("Build valid");
  }

  isEntrypoint(source: ISource, aliased = true): boolean {
    const alias = source.relativeAlias();
    const path = (alias && aliased) ? alias : source.relativePath();

    return this.logger.test(
      sprintf("isEntrypoint: %s", path),
      this.entrypoints.some((pattern) => pattern.test(path)),
    );
  }

  isIgnored(source: ISource): boolean {
    return this.logger.test(
      sprintf("isIgnored: %s", source.relativePath()),
      this.exclude.some((pattern) => pattern.test(source.relativePath())),
    );
  }

  isCompilable(source: ISource): boolean {
    return this.logger.test(
      sprintf("isCompilable: %s", source.relativePath()),
      this.compile.some((pattern) => pattern.test(source.relativePath())),
    );
  }

  isHashable(source: ISource): boolean {
    return this.logger.test(
      sprintf("isHashable: %s", source.relativePath()),
      this.hash.some((pattern) => pattern.test(source.relativePath())),
    );
  }

  isManifestExcluded(source: ISource): boolean {
    return this.logger.test(
      sprintf("isManifestExcluded: %s", source.relativePath()),
      this.manifestExclude.some((pattern) =>
        pattern.test(source.relativePath())
      ),
    );
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
      this.logger.cleaning(this.context.output);
      await Deno.remove(this.context.output, { recursive: true });
    } catch (error) {
      this.logger.error(error);
      // whatever
    }
  }

  async vendorSources(sources: SourceFileBag) {
    const outputPath = join(this.context.output, "vendor");
    const paths: string[] = [];

    const startTime = performance.now();

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
      const vendored = await this.gatherSources(outputPath);
      this.logger.vendored(sources, startTime);

      return vendored;
    } else {
      const error = new TextDecoder().decode(stderr);
      throw new Error(error);
    }
  }

  async copySources(
    sources: SourceFileBag,
    destination: string = this.context.output,
  ) {
    const copied: SourceFileBag = new SourceFileBag();
    const startTime = performance.now();

    for (const source of sources.values()) {
      try {
        if (!this.isIgnored(source)) {
          let copiedSource: ISource;
          const copyStartTime = performance.now();
          if (this.isHashable(source)) {
            copiedSource = await source.copyToHashed(destination);
          } else {
            copiedSource = await source.copyTo(destination);
          }

          copied.add(copiedSource);
          this.logger.copy(source, copiedSource, copyStartTime);
        }
      } catch (error) {
        throw error;
      }
    }

    this.logger.copied(copied, startTime);
    this.hasCopied = true;

    return copied;
  }

  async compileSources(sources: SourceFileBag) {
    this.#valid();
    const { compile } = await import("./compiler.ts");

    for (const sourceFile of sources.values()) {
      if (!this.isCompilable(sourceFile)) {
        throw new Error(
          sprintf(
            "sourceFile is not compilable: %s",
            sourceFile.relativePath(),
          ),
        );
      }

      const startTime = performance.now();
      const source = await sourceFile.read();

      const compiled = await compile(source, {
        filename: sourceFile.path(),
        development: false,
        minify: this.context?.compiler?.minify,
        sourceMaps: this.context?.compiler?.sourceMaps,
      });

      this.logger.compiled(sourceFile, startTime);

      await sourceFile.write(compiled.code);
    }

    return sources;
  }

  processSources(
    sources: SourceFileBag,
    processor: (source: ISource) => Promise<ISource> | ISource,
  ) {
    this.#valid();
    return Promise.all(sources.toArray().map((source) => processor(source)));
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
