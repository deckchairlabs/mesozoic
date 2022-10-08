import { PatternLike, Patterns } from "./patterns.ts";

export type BuildContext = {
  root: string;
  output: string;
  importMapPath: string;
  ignored: Patterns;
  dynamicImportIgnored: Patterns;
  compiled: Patterns;
  hashed: Patterns;
};

export class BuildContextBuilder {
  #root?: string;
  #output?: string;
  #importMapPath?: string;

  #ignored: Patterns = new Patterns();
  #dynamicImportIgnored: Patterns = new Patterns();
  #compiled: Patterns = new Patterns();
  #hashed: Patterns = new Patterns();

  build(): BuildContext {
    /**
     * Validate
     */
    this.valid();

    return {
      root: this.#root!,
      output: this.#output!,
      importMapPath: this.#importMapPath!,
      ignored: this.#ignored,
      dynamicImportIgnored: this.#dynamicImportIgnored,
      compiled: this.#compiled,
      hashed: this.#hashed,
    };
  }

  valid() {
    if (!this.#root) {
      throw new Error("root is not set.");
    }

    if (!this.#output) {
      throw new Error("output is not set.");
    }

    if (!this.#importMapPath) {
      throw new Error("importMapPath is not set.");
    }
  }

  // Setters

  setRoot(value: string) {
    if (value.startsWith(".")) {
      throw new Error("root must be an absolute path.");
    }

    this.#root = value;
    return this;
  }

  setOutput(value: string) {
    if (value.startsWith(".")) {
      throw new Error("root must be an absolute path.");
    }

    this.#output = value;
    return this;
  }

  setImportMapPath(value: string) {
    this.#importMapPath = value;
    return this;
  }

  // Patterns

  ignore(pattern: PatternLike) {
    this.#ignored.add(pattern);
    return this;
  }

  dynamicImportIgnore(pattern: PatternLike) {
    this.#dynamicImportIgnored.add(pattern);
    return this;
  }

  compile(pattern: PatternLike) {
    this.#compiled.add(pattern);
    return this;
  }

  contentHash(pattern: PatternLike) {
    this.#hashed.add(pattern);
    return this;
  }
}
