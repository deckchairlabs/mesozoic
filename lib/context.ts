import { PatternLike, Patterns } from "./patterns.ts";

export type BuildContext = ReturnType<ContextBuilder["build"]>;

export class ContextBuilder {
  #root?: string;
  #output?: string;
  #vendorPath = "vendor";
  #vendorDependencies = true;
  #importMapPath?: string;

  #ignored: Patterns = new Patterns();
  #dynamicImportIgnored: Patterns = new Patterns();
  #compiled: Patterns = new Patterns();
  #hashed: Patterns = new Patterns();

  build() {
    /**
     * Validate
     */
    this.valid();

    return {
      root: this.#root!,
      output: this.#output!,
      vendorPath: this.#vendorPath,
      importMapPath: this.#importMapPath!,
      vendorDependencies: this.#vendorDependencies,
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

  setVendorPath(value: string) {
    this.#vendorPath = value;
    return this;
  }

  setImportMapPath(value: string) {
    this.#importMapPath = value;
    return this;
  }

  setVendorDependencies(value: boolean) {
    this.#vendorDependencies = value;
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
