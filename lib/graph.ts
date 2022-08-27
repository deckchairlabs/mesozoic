import { deepMerge } from "https://deno.land/std@0.153.0/collections/deep_merge.ts";
import type {
  LoadResponse,
  ModuleGraphJson,
} from "https://deno.land/x/deno_graph@0.32.0/lib/types.d.ts";
import { Builder } from "./builder.ts";
import {
  crayon,
  createGraph,
  graphDefaultLoad,
  initModuleLexer,
  parseModule,
  sprintf,
  toFileUrl,
} from "./deps.ts";
import { FileBag } from "./fileBag.ts";
import { ParsedImportMap, resolveSpecifierFromImportMap } from "./importMap.ts";
import { isRemoteSpecifier } from "./utils.ts";

export async function buildModuleGraph(
  builder: Builder,
  entrypoints: FileBag,
  sources: FileBag,
  importMap?: ParsedImportMap,
) {
  let moduleGraph: ModuleGraphJson = {
    roots: [],
    modules: [],
    redirects: {},
    imports: [],
  };

  await initModuleLexer;

  const facadeCache = new Map<string, LoadResponse>();
  const resolveCache = new Map<string, string>();

  const localSources = sources.filter((source) =>
    !isRemoteSpecifier(source.url())
  );

  let didError = false;

  for (const entrypoint of entrypoints.values()) {
    const graph = await createGraph(
      entrypoint.url().href,
      {
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
            resolvedSpecifier = resolveSourceSpecifier(localSources, specifier);
          } else if (
            isRemoteSpecifier(specifier) ||
            (specifier.startsWith("/") && isRemoteSpecifier(referrer))
          ) {
            const url = prepareRemoteUrl(new URL(specifier, referrer));
            resolvedSpecifier = url.href;
          } else {
            // Bare import specifier, attempt to resolve from importMap if provided
            if (importMap) {
              const resolved = resolveSpecifierFromImportMap(
                importMap,
                specifier,
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

          if (resolvedSpecifier !== specifier) {
            moduleGraph.redirects[specifier] = resolvedSpecifier;
          }

          return resolvedSpecifier;
        },
      },
    );

    if (didError) {
      Deno.exit(1);
    }

    // deno-lint-ignore no-explicit-any
    moduleGraph = deepMerge<any>(moduleGraph, graph.toJSON());

    graph.free();
  }

  moduleGraph = resolveRedirects(moduleGraph);

  return moduleGraph;
}

export function resolveSourceSpecifier(sources: FileBag, specifier: string) {
  const source = sources.find((source) => {
    return source.relativePath() === specifier ||
      source.relativeAlias() === specifier;
  });

  if (source) {
    return toFileUrl(source.path()).href;
  }

  return specifier;
}

export function resolveRedirects(graph: ModuleGraphJson) {
  const redirects = new Map(Object.entries(graph.redirects));

  for (const [specifier, redirect] of Object.entries(graph.redirects)) {
    redirects.set(specifier, redirects.get(redirect) || redirect);
  }

  for (const [specifier, redirect] of Object.entries(graph.redirects)) {
    if (isBareSpecifier(specifier)) {
      redirects.delete(specifier);
      redirects.set(specifier, redirects.get(redirect) || redirect);
    }
  }

  graph.redirects = Object.fromEntries(redirects.entries());

  return graph;
}

export function isBareSpecifier(specifier: string) {
  return !isRemoteSpecifier(specifier) && !specifier.startsWith("./") &&
    !specifier.startsWith("../");
}

export async function resolveFacadeModule(response: LoadResponse) {
  if (response.kind === "module") {
    const [imports, exports, facade] = await parseModule(response.content);
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
