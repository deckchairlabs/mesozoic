import { dirname, ensureDir, join } from "./deps.ts";
import { FileBag } from "./fileBag.ts";
import { ModuleGraph, ModuleJson } from "./types.ts";
import { isRemoteSpecifier } from "./utils.ts";
import { Mappings } from "./vendor/mappings.ts";

export async function vendorRemoteSources(graph: ModuleGraph, output: string) {
  const sources = new FileBag();
  const outputDir = join(output, "vendor");

  await ensureDir(outputDir);

  const remoteModules = gatherRemoteModules(graph);

  const mappings = Mappings.fromRemoteModules(remoteModules, outputDir);

  for (const module of remoteModules) {
    const localPath = mappings.localPath(module.specifier);
    if (localPath) {
      await ensureDir(dirname(localPath));
    }
  }

  return sources;
}

export function gatherRemoteModules(graph: ModuleGraph) {
  const remoteSpecifiers = new Set<ModuleJson>();
  for (const [specifier, module] of graph.modules.entries()) {
    if (isRemoteSpecifier(specifier)) {
      // remoteSpecifiers.add(module);
    }

    // if (module.dependencies) {
    //   for (const dependency of module.dependencies) {
    //     if (isRemoteSpecifier(dependency.specifier)) {
    //       remoteSpecifiers.add(dependency);
    //     }
    //   }
    // }
  }

  return remoteSpecifiers;
}
