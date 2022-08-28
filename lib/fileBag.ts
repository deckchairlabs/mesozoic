import { sprintf } from "./deps.ts";
import { IFile } from "./file.ts";

/**
 * A FileBag holds and manages implementations of IFile
 */
export class FileBag extends Set<IFile> {
  private static create(items: IFile[]): FileBag {
    const fileBag = new FileBag();
    if (items) {
      for (const item of items) {
        fileBag.add(item);
      }
    }
    return fileBag;
  }

  get(path: string): Promise<IFile> {
    const source = this.find((source) =>
      source.relativePath() === path || source.relativeAlias() === path
    );
    if (source) {
      return Promise.resolve(source);
    } else {
      return Promise.reject(
        new Error(sprintf("source does not exist at %s", path)),
      );
    }
  }

  /**
   * Merge this FileBag with another
   * @param other
   * @returns A new FileBag with the merged result
   */
  merge(other: FileBag) {
    const sources = new FileBag();

    for (const source of this.values()) {
      sources.add(source);
    }

    for (const source of other.values()) {
      sources.add(source);
    }

    return sources;
  }

  find(predicate: (file: IFile) => boolean) {
    for (const source of this.values()) {
      if (predicate(source)) {
        return source;
      }
    }
  }

  filter(predicate: (file: IFile) => boolean) {
    const items: IFile[] = [];
    for (const source of this.values()) {
      if (predicate(source)) {
        items.push(source);
      }
    }

    return FileBag.create(items);
  }

  toArray() {
    return Array.from(this.values());
  }
}
