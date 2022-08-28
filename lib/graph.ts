import { Builder } from "./builder.ts";
import {
  cache,
  crayon,
  createGraph,
  fromFileUrl,
  graphDefaultLoad,
  initModuleLexer,
  parseModule,
  sprintf,
  toFileUrl,
} from "./deps.ts";
import type { LoadResponse, ResolveResult } from "./types.ts";
import { FileBag } from "./fileBag.ts";
import { isRemoteSpecifier } from "./utils.ts";
import { Entrypoint } from "./entrypointFile.ts";

export async function buildModuleGraph(
  builder: Builder,
  localSources: FileBag,
  entrypoint: Entrypoint,
) {
  await initModuleLexer;

  const bareSpecifiers = new Map<string, string>();

  const graph = await createGraph(
    entrypoint.url().href,
    {
      kind: "codeOnly",
      defaultJsxImportSource: "react",
      async load(specifier) {
        builder.log.debug(sprintf("%s %s", crayon.red("Load"), specifier));

        let response: LoadResponse | undefined = undefined;
        const cached = await cache(specifier);

        if (cached) {
          const content = await Deno.readTextFile(cached.path);
          response = {
            specifier,
            kind: "module",
            content,
          };
        } else {
          response = await graphDefaultLoad(specifier);
        }

        if (bareSpecifiers.has(specifier)) {
          const resolved = builder.resolveImportSpecifier(
            bareSpecifiers.get(specifier)!,
          );
          if (resolved.matched) {
            response = await graphDefaultLoad(resolved.resolvedImport.href);
          } else {
            // Do we need to worry about this?
            // builder.log.error(
            //   sprintf("Could not resolve %s in the importMap", specifier),
            // );
          }
        }

        if (response) {
          const resolvedFacade = await resolveFacadeModule(response);
          if (resolvedFacade) {
            builder.log.debug(
              sprintf("Facade resolved %s", resolvedFacade.specifier),
            );
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

        let resolvedSpecifier: string | ResolveResult = specifier;

        if (specifier.startsWith("./") || specifier.startsWith("../")) {
          // Resolve a relative local file
          if (referrer.startsWith("file://")) {
            resolvedSpecifier = fromFileUrl(new URL(specifier, referrer).href)
              .replace(
                builder.context.output,
                ".",
              );
            resolvedSpecifier = resolveSourceSpecifier(
              localSources,
              resolvedSpecifier,
            );
          } else {
            const url = prepareRemoteUrl(new URL(specifier, referrer));
            resolvedSpecifier = url.href;
          }
        } else if (
          isRemoteSpecifier(specifier) ||
          (specifier.startsWith("/") && isRemoteSpecifier(referrer))
        ) {
          const url = prepareRemoteUrl(new URL(specifier, referrer));
          bareSpecifiers.set(specifier, url.href);
          resolvedSpecifier = url.href;
        } else {
          // Bare import specifier
          const resolved = builder.resolveImportSpecifier(
            specifier,
            new URL(referrer),
          );
          if (resolved && resolved.matched) {
            resolvedSpecifier = resolved.resolvedImport.href;
            bareSpecifiers.set(resolvedSpecifier, specifier);
          }
        }

        builder.log.debug(
          sprintf(
            "%s %s to %s",
            crayon.green("Resolved"),
            specifier,
            resolvedSpecifier,
          ),
        );

        return resolvedSpecifier;
      },
    },
  );

  entrypoint.setBareImportSpecifiers(bareSpecifiers);

  return graph;
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

export function isBareSpecifier(specifier: string) {
  return !isRemoteSpecifier(specifier) &&
    !specifier.startsWith("file://") &&
    !specifier.startsWith("/") &&
    !specifier.startsWith("./") &&
    !specifier.startsWith("../");
}

export async function resolveFacadeModule(
  response: LoadResponse,
): Promise<LoadResponse | undefined> {
  if (response.kind === "module") {
    const [imports, exports, facade] = await parseModule(response.content);
    if (facade && (exports.length === 1 || imports.length === 1)) {
      /**
       * We only do facade detection on remote modules
       */
      const uniqueSpecifiers = Array.from(
        new Set(
          imports.map((element) => element.n).filter((specifier) =>
            specifier?.startsWith("http")
          ),
        ).values(),
      );

      if (uniqueSpecifiers[0]) {
        const specifier = prepareRemoteUrl(new URL(uniqueSpecifiers[0])).href;
        const cached = await cache(specifier);

        if (cached) {
          const content = await Deno.readTextFile(cached.path);
          return {
            specifier,
            kind: "module",
            content,
          };
        } else {
          return graphDefaultLoad(specifier);
        }
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
