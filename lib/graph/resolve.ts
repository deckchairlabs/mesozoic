import {
  parse,
  resolve as importMapResolve,
} from "https://esm.sh/@import-maps/resolve@1.0.1";
import { crayon, fromFileUrl, sprintf } from "../deps.ts";
import { Logger } from "../logger.ts";
import { FileBag } from "../sources/fileBag.ts";
import { ImportMap, ResolveResult } from "../types.ts";
import { wrapFn } from "../utils.ts";
import { isBareSpecifier, isRemoteSpecifier } from "./specifiers.ts";

export type Resolver = (specifier: string, referrer: string) => string;
export type BareSpecifiersMap = Map<string, string>;

type CreateLoaderOptions = {
  importMap: ImportMap;
  sources: FileBag;
  bareSpecifiers: BareSpecifiersMap;
  baseURL: URL;
};

export function createResolver(options: CreateLoaderOptions): Resolver {
  const { importMap, sources, bareSpecifiers, baseURL } = options;
  const parsedImportMap = parse(importMap, baseURL);

  return (specifier: string, referrer: string): string => {
    let resolved = resolve(specifier, referrer);

    const importMapResolved = importMapResolve(
      specifier,
      parsedImportMap,
      new URL(referrer),
    );

    /**
     * If we get a resolved match from the importMap
     * we use that over anything else.
     */
    if (importMapResolved.matched) {
      resolved = importMapResolved.resolvedImport.href;
      bareSpecifiers.set(specifier, resolved);
    } else if (resolved.startsWith("file://")) {
      /**
       * This is a local source file, attempt to find it within the sources FileBag
       */
      let path = resolved.replace(referrer, "./");
      path = path.startsWith("file://") ? fromFileUrl(path) : path;

      const source = sources.find((source) => {
        return source.alias() === path || source.path() === path;
      });

      if (source) {
        resolved = String(source.url());
      } else {
        throw new Error(
          sprintf(
            "failed to resolve local source %s from %s",
            specifier,
            referrer,
          ),
        );
      }
    }

    return resolved;
  };
}

export function wrapResolverWithLogging(
  resolver: Resolver,
  logger: Logger,
): Resolver {
  const before = (specifier: string, referrer: string) =>
    logger.debug(
      sprintf(
        "%s %s from %s",
        crayon.lightBlue("Resolve"),
        specifier,
        referrer,
      ),
    );

  const after = (resolved: string, specifier: string) =>
    logger?.debug(
      sprintf(
        "%s %s to %s",
        crayon.green("Resolved"),
        specifier,
        resolved,
      ),
    );

  return wrapFn(resolver, before, after);
}

export function resolve(specifier: string, referrer: string) {
  let resolvedSpecifier: string | ResolveResult = specifier;

  try {
    if (isBareSpecifier(specifier)) {
      if (specifier.startsWith("/") && isRemoteSpecifier(referrer)) {
        resolvedSpecifier = String(new URL(specifier, referrer));
      } else {
        resolvedSpecifier = specifier;
      }
    } else {
      const url = new URL(specifier, referrer);
      resolvedSpecifier = String(url);
    }
  } catch {
    throw new Error(
      sprintf("could not resolve %s from %s", specifier, referrer),
    );
  }

  return resolvedSpecifier;
}

export function resolveBareSpecifierRedirects(
  specifiers: BareSpecifiersMap,
  redirects: Record<string, string>,
) {
  for (const [specifier, resolved] of specifiers.entries()) {
    specifiers.set(specifier, redirects[resolved] || resolved);
  }

  return specifiers;
}
