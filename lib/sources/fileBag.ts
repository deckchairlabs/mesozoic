import { normalize, sprintf, walk } from "../deps.ts";
import { rootUrlToSafeLocalDirname } from "../fs.ts";
import { ModuleGraph } from "../types.ts";
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

  static fromModuleGraph(graph: ModuleGraph, destination: string) {
    const items: IFile[] = [];
    const modules = graph.modules.values();

    for (const module of modules) {
      if (module.specifier.startsWith("file://") === false) {
        const resolved = graph.get(module.specifier);

        if (resolved) {
          const path = rootUrlToSafeLocalDirname(
            new URL(module.specifier),
            destination,
          );

          items.push(
            new VirtualFile(path, destination, resolved.source),
          );
        }
      } else {
        console.log(module.specifier);
      }
    }
    return new FileBag(items);
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

  async copyTo(destination: string) {
    const items: IFile[] = [];

    for (const source of this.values()) {
      try {
        const copied = await source.copyTo(destination);
        if (copied) {
          items.push(copied);
        }
      } catch (error) {
        throw error;
      }
    }

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

  toArray() {
    return Array.from(this.values());
  }
}
