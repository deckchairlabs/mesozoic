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
import type { LoadResponse, ResolveResult } from "./types.ts";
import { IFile } from "./file.ts";
import { FileBag } from "./fileBag.ts";
import { isRemoteSpecifier } from "./utils.ts";

export async function buildModuleGraph(
  builder: Builder,
  localSources: FileBag,
  entrypoint: IFile,
) {
  await initModuleLexer;

  const bareSpecifiers = new Map<string, string>();

  return await createGraph(
    entrypoint.url().href,
    {
      kind: "codeOnly",
      defaultJsxImportSource: "react",
      async load(specifier) {
        builder.log.info(sprintf("%s %s", crayon.red("Load"), specifier));
        let response = await graphDefaultLoad(specifier);

        if (bareSpecifiers.has(specifier)) {
          const resolved = builder.resolveImportSpecifier(
            bareSpecifiers.get(specifier)!,
          );
          if (resolved.matched) {
            response = await graphDefaultLoad(resolved.resolvedImport.href);
          } else {
            builder.log.error(
              sprintf("Could not resolve %s in the importMap", specifier),
            );
          }
        }

        if (response) {
          const resolvedFacade = await resolveFacadeModule(response);
          if (resolvedFacade) {
            builder.log.info(
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

        if (specifier.startsWith("./")) {
          resolvedSpecifier = resolveSourceSpecifier(localSources, specifier);
        } else if (
          isRemoteSpecifier(specifier) ||
          (specifier.startsWith("/") && isRemoteSpecifier(referrer))
        ) {
          const url = prepareRemoteUrl(new URL(specifier, referrer));
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

        builder.log.info(
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

  // if (didError) {
  //   graph.free();
  //   Deno.exit(1);
  // }

  // const graphJson = graph.toJSON();

  // /**
  //  * Merge and resolve redirects
  //  */
  // redirects = resolveRedirects(deepMerge(graphJson.redirects, redirects));

  // return [graph, redirects] as const;
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
