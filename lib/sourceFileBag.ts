import { SourceFile } from "./sourceFile.ts";

/**
 * A SourceFileBag holds SourceFiles
 */
export class SourceFileBag {
  items: Map<string, SourceFile>;

  constructor() {
    this.items = new Map();
  }

  private static create(items: SourceFile[]): SourceFileBag {
    const fileBag = new SourceFileBag();
    if (items) {
      for (const item of items) {
        fileBag.add(item);
      }
    }
    return fileBag;
  }

  find(predicate: (file: SourceFile) => boolean) {
    return this.toArray().find(predicate);
  }

  filter(predicate: (file: SourceFile) => boolean) {
    return SourceFileBag.create(this.toArray().filter(predicate));
  }

  add(value: SourceFile) {
    this.items.set(value.path(), value);
    return this;
  }

  has(key: string) {
    return this.items.has(key);
  }

  get(key: string) {
    return this.items.get(key);
  }

  get size() {
    return this.items.size;
  }

  values() {
    return this.items.values();
  }

  toArray() {
    return Array.from(this.values());
  }
}
