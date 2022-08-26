import { ISource } from "./source.ts";

/**
 * A SourceFileBag holds ISource
 */
export class SourceFileBag extends Set<ISource> {
  private static create(items: ISource[]): SourceFileBag {
    const fileBag = new SourceFileBag();
    if (items) {
      for (const item of items) {
        fileBag.add(item);
      }
    }
    return fileBag;
  }

  /**
   * Merge this SourceFileBag with another
   * @param other
   * @returns A new SourceFileBag with the merged result
   */
  merge(other: SourceFileBag) {
    const sources = new SourceFileBag();

    for (const source of this.values()) {
      sources.add(source);
    }

    for (const source of other.values()) {
      sources.add(source);
    }

    return sources;
  }

  find(predicate: (file: ISource) => boolean) {
    for (const source of this.values()) {
      if (predicate(source)) {
        return source;
      }
    }
  }

  filter(predicate: (file: ISource) => boolean) {
    const items: ISource[] = [];
    for (const source of this.values()) {
      if (predicate(source)) {
        items.push(source);
      }
    }

    return SourceFileBag.create(items);
  }

  toArray() {
    return Array.from(this.values());
  }
}
