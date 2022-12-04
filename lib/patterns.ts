import { globToRegExp } from "./deps.ts";
import { GlobToRegExpOptions } from "./types.ts";

export type PatternLike = string | string[];

export class Patterns {
  #values: Set<string> = new Set();
  #negate: Set<string> = new Set();

  #patterns?: RegExp[];
  #negated?: RegExp[];

  #built = false;

  constructor(values: PatternLike = []) {
    this.add(values);
  }

  build() {
    if (!this.#built) {
      this.#patterns = this.#build(this.#values);
      this.#negated = this.#build(this.#negate);
      this.#built = true;
    }
  }

  add(value: PatternLike) {
    value = typeof value === "string" ? [value] : value;
    for (let element of value) {
      if (element.startsWith("!")) {
        element = element.substring(1);
        this.#negate.add(element);
      }
      this.#values.add(element);
    }

    return this;
  }

  test(string: string): boolean {
    if (!this.#built) {
      throw new Error("Patterns must be built before testing.");
    }

    const matches = this.#patterns!.some((pattern) => pattern.test(string));
    const negated = this.#negated!.some((pattern) => pattern.test(string));

    return matches && negated === false;
  }

  #globToRegExp(pattern: string, options: GlobToRegExpOptions = {
    extended: true,
    globstar: true,
    caseInsensitive: false,
  }): RegExp {
    return globToRegExp(pattern, options);
  }

  #build(patterns: Set<string>) {
    return Array.from(patterns).map((value) => {
      value = value.endsWith("/") ? `${value}**` : value;
      return this.#globToRegExp(value);
    });
  }
}
