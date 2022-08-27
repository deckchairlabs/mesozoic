import type { LoadResponse } from "https://deno.land/x/deno_graph@0.32.0/lib/types.d.ts";
import { init, parse } from "https://esm.sh/es-module-lexer@1.0.3";
import { Builder } from "./builder.ts";
import {
  crayon,
  createGraph,
  graphDefaultLoad,
  sprintf,
  toFileUrl,
} from "./deps.ts";
import { FileBag } from "./fileBag.ts";
import { ParsedImportMap, resolveSpecifier } from "./importMap.ts";
import { ModuleGraph } from "./types.ts";
import { isRemoteSpecifier } from "./utils.ts";

export async function buildModuleGraph(
  builder: Builder,
  sources: FileBag,
  importMap?: ParsedImportMap,
): Promise<ModuleGraph> {
  const moduleGraph: ModuleGraph = {
    roots: new Set(),
    modules: new Map(),
  };

  await init;
  const entrypoints = sources.filter((source) => builder.isEntrypoint(source));

  const facadeCache = new Map<string, LoadResponse>();
  const resolveCache = new Map<string, string>();

  let didError = false;

  for (const entrypoint of entrypoints.values()) {
    const sourceGraph = await createGraph(entrypoint.url().href, {
      kind: "codeOnly",
      defaultJsxImportSource: "react",
      async load(specifier) {
        builder.log.debug(sprintf("Load %s", specifier));
        const response = await graphDefaultLoad(specifier);

        if (response) {
          if (facadeCache.has(response.specifier)) {
            builder.log.debug(crayon.green("Facade cache hit"));
            return facadeCache.get(response.specifier)!;
          }

          const resolvedFacade = await resolveFacadeModule(response);
          if (resolvedFacade) {
            builder.log.debug(
              sprintf("Facade resolved %s", resolvedFacade.specifier),
            );
            facadeCache.set(response.specifier, resolvedFacade);
            return resolvedFacade;
          }
        }

        return response;
      },
      resolve(specifier, referrer) {
        builder.log.debug(
          sprintf(
            "%s %s from %s",
            crayon.lightBlue("Resolve"),
            specifier,
            referrer,
          ),
        );

        const cacheKey = `${referrer}:${specifier}`;

        if (resolveCache.has(cacheKey)) {
          builder.log.debug(crayon.green("Resolve cache hit"));
          return resolveCache.get(cacheKey)!;
        }

        let resolvedSpecifier: string = specifier;

        if (specifier.startsWith("./")) {
          const source = sources.find((source) => {
            return source.relativePath() === specifier ||
              source.relativeAlias() === specifier;
          });

          if (source) {
            resolvedSpecifier = toFileUrl(source.path()).href;
          }
        } else if (
          isRemoteSpecifier(specifier) ||
          (specifier.startsWith("/") && isRemoteSpecifier(referrer))
        ) {
          const url = prepareRemoteUrl(new URL(specifier, referrer));
          resolvedSpecifier = url.href;
        } else {
          // Bare import specifier, attempt to resolve from importMap if provided
          if (importMap) {
            const resolved = resolveSpecifier(
              specifier,
              importMap,
              new URL(referrer),
            );

            if (resolved.matched) {
              resolvedSpecifier = resolved.resolvedImport.href;
            } else {
              builder.log.warning(
                sprintf("Could not resolve %s in the importMap", specifier),
              );
            }
          } else {
            builder.log.error(sprintf(
              'Cannot resolve a bare import specifier "%s" without an importMap',
              specifier,
            ));
            didError = true;
          }
        }

        if (!didError) {
          builder.log.debug(
            sprintf(
              "%s %s to %s",
              crayon.green("Resolved"),
              specifier,
              resolvedSpecifier,
            ),
          );
          resolveCache.set(cacheKey, resolvedSpecifier);
        }

        return resolvedSpecifier;
      },
    });

    if (didError) {
      Deno.exit(1);
    }

    for (const root of sourceGraph.roots) {
      moduleGraph.roots.add(root);
    }

    for (const module of sourceGraph.modules.values()) {
      const dependencies: Set<string> = new Set();

      if (module.dependencies) {
        for (const dependency of Object.values(module.dependencies)) {
          if (dependency.code && dependency.code.specifier) {
            dependencies.add(dependency.code.specifier);
          }
        }
      }

      moduleGraph.modules.set(module.specifier, dependencies);
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
        const specifier = prepareRemoteUrl(new URL(uniqueImports[0]));
        return await graphDefaultLoad(specifier.href);
      }
    }
  }
}

export function prepareRemoteUrl(url: URL) {
  switch (url.host) {
    case "esm.sh":
      /**
       * We don't want types from esm.sh
       */
      url.searchParams.append("no-dts", "");
      /**
       * We only target modern javascript
       */
      url.searchParams.append("target", "es2020");
      /**
       * We don't want development sources
       */
      url.searchParams.delete("dev");
      break;
  }

  return url;
}
