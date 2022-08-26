import {
  cache,
  directory as cacheDirectory,
} from "https://deno.land/x/cache@0.2.13/mod.ts";
import { dirname, ensureDir, join } from "./deps.ts";
import { SourceFileBag } from "./sourceFileBag.ts";
import { ModuleGraph, ModuleJson } from "./types.ts";
import { isRemoteSpecifier } from "./utils.ts";
import { Mappings } from "./vendor/mappings.ts";

export async function vendorRemoteSources(graph: ModuleGraph, output: string) {
  const sources = new SourceFileBag();
  const outputDir = join(output, "vendor");

  await ensureDir(outputDir);

  const remoteModules = gatherRemoteModules(graph);
  const denoCacheDir = cacheDirectory();

  const mappings = Mappings.fromRemoteModules(remoteModules, outputDir);

  for (const module of remoteModules) {
    const localPath = mappings.localPath(module.specifier);
    if (localPath) {
      await ensureDir(dirname(localPath));
    }
  }

  // for (const remoteSpecifier of remoteSpecifiers) {
  //   const cached = await cache(remoteSpecifier);

  //   const content = await fetch(toFileUrl(cached.path)).then((response) =>
  //     response.arrayBuffer()
  //   );

  //   const path = join(outputDir, rootUrlToSafeLocalDirname(cached.url));
  //   console.log(path);

  //   // const source = new VirtualSourceFile(
  //   //   path,
  //   //   denoCacheDir,
  //   //   new Uint8Array(content),
  //   // );

  //   // sources.add(source);
  // }

  // // const mappings = fromRemoteModules(graph, remoteModules);

  return sources;
}

export function gatherRemoteModules(graph: ModuleGraph) {
  const remoteSpecifiers = new Set<ModuleJson>();
  for (const [specifier, module] of graph.modules.entries()) {
    if (isRemoteSpecifier(specifier)) {
      remoteSpecifiers.add(module);
    }

    if (module.dependencies) {
      for (const dependency of module.dependencies) {
        if (isRemoteSpecifier(dependency.specifier)) {
          remoteSpecifiers.add(dependency);
        }
      }
    }
  }

  return remoteSpecifiers;
}
