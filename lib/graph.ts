import { createGraph, toFileUrl } from "./deps.ts";
import { SourceFileBag } from "./sourceFileBag.ts";
import { ModuleGraph } from "./types.ts";
import { isRemoteSpecifier } from "./utils.ts";

export async function buildModuleGraph(
  sources: SourceFileBag,
  entrypoints: SourceFileBag,
): Promise<ModuleGraph> {
  const moduleGraph: ModuleGraph = {
    roots: new Set(),
    modules: new Map(),
  };

  for (const entrypoint of entrypoints.values()) {
    const sourceGraph = await createGraph(entrypoint.url().href, {
      kind: "codeOnly",
      defaultJsxImportSource: "react",
      resolve(specifier, referrer) {
        console.log(specifier);

        if (specifier.startsWith("./")) {
          const source = sources.find((source) => {
            return source.relativePath() === specifier ||
              source.relativeAlias() === specifier;
          });

          if (source) {
            return toFileUrl(source.path()).href;
          }
        } else if (
          isRemoteSpecifier(specifier) ||
          (specifier.startsWith("/") && isRemoteSpecifier(referrer))
        ) {
          const url = new URL(specifier, referrer);

          /**
           * We don't want types
           */
          if (url.host === "esm.sh") {
            url.searchParams.append("no-dts", "");
            url.searchParams.append("target", "es2020");
            url.searchParams.delete("dev");
          }

          return url.href;
        } else {
          // Bare import specifier
          // console.log(specifier, referrer)
        }

        return specifier;
      },
    });

    for (const root of sourceGraph.roots) {
      moduleGraph.roots.add(root);
    }

    for (const module of sourceGraph.modules.values()) {
      moduleGraph.modules.set(module.specifier, module.toJSON());
    }

    sourceGraph.free();
  }

  return moduleGraph;
}
