import { Builder } from "./builder.ts";
import { FileBag } from "./fileBag.ts";
import { ModuleGraph } from "./types.ts";
import { ensureDir, join } from "./deps.ts";
import { isRemoteSpecifier } from "./utils.ts";

export async function vendorRemoteModules(
  builder: Builder,
  graph: ModuleGraph,
  sources: FileBag,
) {
  const outputDir = join(builder.context.output, "vendor");

  await ensureDir(outputDir);
  const remoteModules = [];

  for (const [specifier, module] of graph.modules.entries()) {
    if (isRemoteSpecifier(specifier)) {
      console.log(specifier);
    }
  }

  return sources;
}
