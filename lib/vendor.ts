import { join } from "./deps.ts";
import { rootUrlToSafeLocalDirname } from "./fs.ts";
import { FileBag } from "./sources/fileBag.ts";
import { VirtualFile } from "./sources/virtualFile.ts";
import type { ModuleGraph } from "./types.ts";

type VendorModuleGraphOptions = {
  name: string;
  output: string;
  vendorPath: string;
};

export function vendorModuleGraph(
  graph: ModuleGraph,
  options: VendorModuleGraphOptions,
): FileBag {
  const {
    output,
    vendorPath,
    name,
  } = options;

  const vendorSources = new FileBag();
  const modules = graph.modules.values();

  for (const module of modules) {
    if (module.specifier.startsWith("file://") === false) {
      const resolved = graph.get(module.specifier);

      if (resolved) {
        const path = rootUrlToSafeLocalDirname(
          new URL(module.specifier),
          join(output, vendorPath, name),
        );

        const file = new VirtualFile(path, output, resolved.source);
        vendorSources.add(file);
      }
    }
  }

  return vendorSources;
}
