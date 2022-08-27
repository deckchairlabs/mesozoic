import type { LoadResponse } from "https://deno.land/x/deno_graph@0.32.0/lib/types.d.ts";
import { init, parse } from "https://esm.sh/es-module-lexer@1.0.3";
import { createGraph, graphDefaultLoad, toFileUrl } from "./deps.ts";
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

  await init;

  for (const entrypoint of entrypoints.values()) {
    const sourceGraph = await createGraph(entrypoint.url().href, {
      kind: "codeOnly",
      defaultJsxImportSource: "react",
      async load(specifier) {
        let response = await graphDefaultLoad(specifier);

        if (response) {
          response = await resolveFacadeModule(response);
        }

        return response;
      },
      resolve(specifier, referrer) {
        if (specifier.startsWith("./")) {
          const source = sources.find((source) => {
            return source.relativePath() === specifier ||
              source.relativeAlias() === specifier;
          });

          if (source) {
            specifier = toFileUrl(source.path()).href;
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

          specifier = url.href;
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

export async function resolveFacadeModule(response: LoadResponse) {
  if (response.kind === "module") {
    const [imports, exports, facade] = await parse(response.content);
    if (facade && exports.length === 1) {
      const uniqueImports = Array.from(
        new Set(imports.map((element) => element.n)).values(),
      );

      if (uniqueImports[0]) {
        return await graphDefaultLoad(uniqueImports[0]);
      }
    }
  }

  return response;
}
