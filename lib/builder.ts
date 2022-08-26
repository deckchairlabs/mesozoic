import { globToRegExp, join, resolve, sprintf, walk } from "./deps.ts";
import { SourceFile } from "./sourceFile.ts";
import { SourceFileBag } from "./sourceFileBag.ts";
import { MesozoicLogger } from "./logger.ts";

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
  private sources: SourceFileBag;
  private hasCopied = false;
  private isValid = false;
  private logger: MesozoicLogger;

  public entrypoints: RegExp[];
  public exclude: RegExp[];
  public hash: RegExp[];
  public compile: RegExp[];
  public manifestExclude: RegExp[];

  /**
   * @param context
   */
  constructor(public readonly context: BuildContext) {
    this.sources = new SourceFileBag();

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
    this.logger = new MesozoicLogger(context.debug ? "DEBUG" : "INFO");
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

  isEntrypoint(source: SourceFile, aliased = true): boolean {
    const alias = source.relativeAlias();
    const path = (alias && aliased) ? alias : source.relativePath();

    return this.logger.test(
      sprintf("isEntrypoint: %s", path),
      this.entrypoints.some((pattern) => pattern.test(path)),
    );
  }

  isIgnored(source: SourceFile): boolean {
    return this.logger.test(
      sprintf("isIgnored: %s", source.relativePath()),
      this.exclude.some((pattern) => pattern.test(source.relativePath())),
    );
  }

  isCompilable(source: SourceFile): boolean {
    return this.logger.test(
      sprintf("isCompilable: %s", source.relativePath()),
      this.compile.some((pattern) => pattern.test(source.relativePath())),
    );
  }

  isHashable(source: SourceFile): boolean {
    return this.logger.test(
      sprintf("isHashable: %s", source.relativePath()),
      this.hash.some((pattern) => pattern.test(source.relativePath())),
    );
  }

  isManifestExcluded(source: SourceFile): boolean {
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
  async gatherSources() {
    for await (const entry of walk(this.context.root)) {
      if (entry.isFile) {
        const sourceFile = new SourceFile(entry.path, this.context.root);
        this.sources.add(sourceFile);
      }
    }

    return this.sources;
  }

  async cleanOutput() {
    try {
      this.logger.debug(sprintf("Cleaning: %s", this.context.output));
      await Deno.remove(this.context.output, { recursive: true });
    } catch (error) {
      this.logger.error(error);
      // whatever
    }
  }

  add(path: string) {
    const sourceFile = new SourceFile(path, this.context.root);
    this.sources.add(sourceFile);
    this.logger.added(sourceFile);

    return sourceFile;
  }

  resolveSource(path: string) {
    const sourceFile = this.sources.get(this.relative(path));

    if (!sourceFile) {
      throw new Error(
        sprintf("no source file was found at path: %s", path),
      );
    }

    this.logger.resolved(sourceFile);
    return sourceFile;
  }

  async vendorSources(sources: SourceFileBag) {
    const outputPath = join(this.context.output, "vendor");
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
      this.logger.vendored(sources);
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

    for (const source of sources.values()) {
      try {
        if (!this.isIgnored(source)) {
          let copiedSource: SourceFile;
          if (this.isHashable(source)) {
            copiedSource = await source.copyToHashed(destination);
          } else {
            copiedSource = await source.copyTo(destination);
          }

          copied.add(copiedSource);
          this.logger.copied(source, copiedSource);
        }
      } catch (error) {
        throw error;
      }
    }

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

      const source = await sourceFile.read();

      const compiled = await compile(source, {
        filename: sourceFile.path(),
        development: false,
        minify: this.context?.compiler?.minify,
        sourceMaps: this.context?.compiler?.sourceMaps,
      });

      this.logger.compiled(sourceFile);

      await sourceFile.write(compiled.code);
    }

    return sources;
  }

  processSources(
    sources: SourceFileBag,
    processor: (source: SourceFile) => Promise<SourceFile> | SourceFile,
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

  relative(path: string, to: string = this.context.root) {
    return join(to, path);
  }

  resolve(path: string, from: string = this.context.root) {
    return resolve(from, path);
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
