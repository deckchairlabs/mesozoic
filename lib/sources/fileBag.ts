import { fromFileUrl, normalize, sprintf, walk } from "../deps.ts";
import { rootUrlToSafeLocalDirname } from "../fs.ts";
import { isRemoteSpecifier } from "../graph/specifiers.ts";
import { PatternLike, Patterns } from "../patterns.ts";
import { Module } from "../types.ts";
import { IFile } from "./file.ts";
import { SourceFile } from "./sourceFile.ts";
import { VirtualFile } from "./virtualFile.ts";

/**
 * A FileBag holds and manages implementations of IFile
 */
export class FileBag extends Set<IFile> {
  static async from(path: string) {
    const items: IFile[] = [];

    for await (const entry of walk(path)) {
      if (entry.isFile) {
        const sourceFile = new SourceFile(normalize(entry.path), path);
        items.push(sourceFile);
      }
    }

    return new FileBag(items);
  }

  static fromModules(
    modules: Module[],
    path: string,
  ) {
    const items: IFile[] = [];

    for (const module of modules) {
      if (isRemoteSpecifier(module.specifier)) {
        const safePath = rootUrlToSafeLocalDirname(
          new URL(module.specifier),
          ".",
        );

        const file = new VirtualFile(safePath, path, module.source);
        items.push(file);
      } else {
        const file = new VirtualFile(
          fromFileUrl(module.specifier),
          path,
          module.source,
        );
        items.push(file);
      }
    }

    return new FileBag(items);
  }

  remappedPaths(): Map<string, string> {
    const remappedPaths = new Map<string, string>();
    for (const source of this.values()) {
      remappedPaths.set(
        source.originalPath().relativePath(),
        source.relativePath(),
      );
    }
    return remappedPaths;
  }

  get(path: string): Promise<IFile> {
    const source = this.find((source) => source.relativePath() === path);
    if (source) {
      return Promise.resolve(source);
    } else {
      return Promise.reject(
        new Error(sprintf("source does not exist at %s", path)),
      );
    }
  }

  async copyTo(destination: string) {
    const items: IFile[] = [];

    await Promise.all(
      Array.from(this.values()).map(async (source) => {
        const copied = await source.copyTo(destination);
        if (copied) {
          items.push(copied);
        }
      }),
    );

    return new FileBag(items);
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

    return new FileBag(items);
  }

  matches(patterns: PatternLike) {
    const pattern = new Patterns(patterns);
    pattern.build();

    return this.filter((file) => pattern.test(file.relativePath()));
  }

  toArray() {
    return Array.from(this.values());
  }
}
