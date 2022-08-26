import { globToRegExp, join, resolve, sprintf, walk } from "./deps.ts";
import { SourceFile } from "./sourceFile.ts";
import { SourceFileBag } from "./sourceFileBag.ts";

export type BuildContext = {
  root: string;
  output: string;
  entrypoints?: string[];
  hashable?: string[];
  compilable?: string[];
  ignore?: string[];
  compiler?: {
    minify?: boolean;
    sourceMaps?: boolean;
  };
};

export class Builder {
  private sources: SourceFileBag;
  private ignored: SourceFileBag;
  private entrypoints: SourceFileBag;

  public ignorePatterns: RegExp[];
  public hashPatterns: RegExp[];
  public compilePatterns: RegExp[];

  /**
   * @param context
   */
  constructor(public readonly context: BuildContext) {
    this.sources = new SourceFileBag();
    this.ignored = new SourceFileBag();
    this.entrypoints = this.#resolveEntrypoints(this.context);

    this.ignorePatterns = this.#buildPatterns(
      this.context?.ignore,
    );
    this.hashPatterns = this.#buildPatterns(
      this.context?.hashable,
    );
    this.compilePatterns = this.#buildPatterns(
      this.context?.compilable,
    );
  }

  get(bag: "sources" | "ignored" | "entrypoints") {
    switch (bag) {
      case "sources":
        return this.sources;
      case "entrypoints":
        return this.entrypoints;
      case "ignored":
        return this.ignored;
    }
  }

  isEntrypoint(path: string) {
    return this.entrypoints.has(this.relative(path));
  }

  isIgnored(source: SourceFile) {
    return this.ignorePatterns.some((pattern) =>
      pattern.test(source.relativePath())
    );
  }

  isCompilable(source: SourceFile) {
    return this.compilePatterns.some((pattern) =>
      pattern.test(source.relativePath())
    );
  }

  isHashable(source: SourceFile) {
    return this.hashPatterns.some((pattern) =>
      pattern.test(source.relativePath())
    );
  }

  /**
   * Walk the root for files obeying exclusion patterns
   */
  async gatherSources() {
    for await (const entry of walk(this.context.root)) {
      if (entry.isFile) {
        const sourceFile = new SourceFile(entry.path, this.context.root);
        if (this.isIgnored(sourceFile)) {
          this.ignored.add(sourceFile);
        } else {
          this.sources.add(sourceFile);
        }
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

  async execute() {
  }

  async copySources(destination: string = this.context.output) {
    const copied: SourceFileBag = new SourceFileBag();

    for (const source of this.sources.values()) {
      try {
        if (this.isHashable(source)) {
          copied.add(await source.copyToHashed(destination));
        } else {
          copied.add(await source.copyTo(destination));
        }
      } catch (error) {
        throw error;
      }
    }

    return copied;
  }

  async compileSources(sources: SourceFileBag) {
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

  /**
   * @param prefix
   * @returns
   */
  toJSON(prefix?: string) {
    const json = [];

    for (const source of this.sources.values()) {
      json.push(source.toJSON(prefix));
    }

    return json;
  }

  relative(path: string, to: string = this.context.root) {
    return join(to, path);
  }

  resolve(path: string, from: string = this.context.root) {
    return resolve(from, path);
  }

  #resolveEntrypoints(context: BuildContext) {
    const entrypoints = new SourceFileBag();

    if (context.entrypoints) {
      for (const entrypoint of context.entrypoints) {
        entrypoints.add(new SourceFile(entrypoint, this.context.root));
      }
    }

    return entrypoints;
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
