import {
  fromFileUrl,
  toFileUrl,
} from "https://deno.land/std@0.97.0/path/win32.ts";
import BTree from "https://esm.sh/sorted-btree@1.8.0";
import { join } from "../deps.ts";
import { getUniquePath } from "../fs.ts";
import { ModuleJson } from "../types.ts";
import { rootUrlToSafeLocalDirname } from "../utils.ts";

export class Mappings {
  constructor(
    public mappings: Map<string, string>,
    public baseSpecifiers: Set<string>,
  ) {}

  localPath(specifier: string) {
    const url = new URL(specifier);

    if (url.protocol === "file:") {
      return fromFileUrl(url);
    }

    return this.mappings.get(url.href);
  }

  static fromRemoteModules(
    remoteModules: Set<ModuleJson>,
    outputDir: string,
  ) {
    const remoteSpecifiers = new Set(
      Array.from(remoteModules.values()).map((remote) =>
        new URL(remote.specifier)
      ),
    );

    const partitionedSpecifiers = partitionByRootSpecifiers(remoteSpecifiers);
    const mappedPaths = new Set<string>();
    const mappings = new Map<string, string>();
    const baseSpecifiers = new Set<string>();

    for (const [rootSpecifier, specifiers] of partitionedSpecifiers.entries()) {
      const baseDir = getUniquePath(
        join(outputDir, rootUrlToSafeLocalDirname(new URL(rootSpecifier))),
        mappedPaths,
      );

      for (const specifier of specifiers) {
        const path = join(baseDir, makeUrlRelative(rootSpecifier, specifier));
        mappings.set(specifier.href, getUniquePath(path, mappedPaths));
      }

      baseSpecifiers.add(rootSpecifier);
      mappings.set(new URL(rootSpecifier).href, baseDir);
    }

    return new Mappings(mappings, baseSpecifiers);
  }
}

function makeUrlRelative(root: string, url: URL) {
  return url.href.replace(root, "./").replace(url.search, "");
}

export function partitionByRootSpecifiers(specifiers: Set<URL>) {
  const rootSpecifiers = new BTree<string, Set<URL>>();

  for (const specifier of specifiers.values()) {
    const entry = rootSpecifiers.get(specifier.origin) || new Set();
    entry.add(specifier);

    rootSpecifiers.set(specifier.origin, entry);
  }

  return rootSpecifiers;
}
