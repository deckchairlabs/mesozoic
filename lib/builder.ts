import { globToRegExp, join, resolve, sprintf, walk } from "./deps.ts";
import { SourceFile } from "./sourceFile.ts";
import { SourceFileBag } from "./sourceFileBag.ts";

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
};

export class Builder {
  private sources: SourceFileBag;
  private hasCopied = false;

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
  }

  async build(sources: SourceFileBag) {
    this.#valid();

    /**
     * Gather compilable sources and compile them
     */
    const compilable = sources.filter((source) => this.isCompilable(source));
    const compiled = await this.compileSources(compilable);

    return sources;
  }

  #valid() {
    if (!this.hasCopied) {
      throw new Error("must copy sources before performing a build.");
    }
  }

  isEntrypoint(source: SourceFile) {
    return this.entrypoints.some((pattern) => {
      const alias = source.relativeAlias();
      if (alias) {
        return pattern.test(alias);
      }
      return pattern.test(source.relativePath());
    });
  }

  isIgnored(source: SourceFile) {
    return this.exclude.some((pattern) => pattern.test(source.relativePath()));
  }

  isCompilable(source: SourceFile) {
    return this.compile.some((pattern) => pattern.test(source.relativePath()));
  }

  isHashable(source: SourceFile) {
    return this.hash.some((pattern) => pattern.test(source.relativePath()));
  }

  isManifestExcluded(source: SourceFile) {
    return this.manifestExclude.some((pattern) =>
      pattern.test(source.relativePath())
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
      await Deno.remove(this.context.output, { recursive: true });
    } catch (_error) {
      // whatever
    }
  }

  add(path: string) {
    const sourceFile = new SourceFile(path, this.context.root);
    this.sources.add(sourceFile);

    return sourceFile;
  }

  resolveSource(path: string) {
    const sourceFile = this.sources.get(this.relative(path));

    if (!sourceFile) {
      throw new Error(
        sprintf("no source file was found at path: %s", path),
      );
    }

    return sourceFile;
  }

  async copySources(
    sources: SourceFileBag,
    destination: string = this.context.output,
  ) {
    const copied: SourceFileBag = new SourceFileBag();

    for (const source of sources.values()) {
      try {
        if (!this.isIgnored(source)) {
          if (this.isHashable(source)) {
            copied.add(await source.copyToHashed(destination));
          } else {
            copied.add(await source.copyTo(destination));
          }
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
