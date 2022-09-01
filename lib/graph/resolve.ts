import {
  parse,
  resolve as importMapResolve,
} from "https://esm.sh/@import-maps/resolve@1.0.1";
import { fromFileUrl, sprintf } from "../deps.ts";
import { FileBag } from "../sources/fileBag.ts";
import { ImportMap, ResolveResult } from "../types.ts";
import { isBareSpecifier, isRemoteSpecifier } from "./specifiers.ts";

export type Resolver = (specifier: string, referrer: string) => string;
export type BareSpecifiersMap = Map<string, string>;

export function createResolver(
  importMap: ImportMap,
  sources: FileBag,
  bareSpecifiers: BareSpecifiersMap,
  baseUrl: URL,
): Resolver {
  const parsedImportMap = parse(importMap, baseUrl);

  return (specifier: string, referrer: string): string => {
    let resolved = resolve(specifier, referrer);

    const importMapResolved = importMapResolve(
      specifier,
      parsedImportMap,
      new URL(referrer),
    );

    if (importMapResolved.matched) {
      resolved = importMapResolved.resolvedImport.href;
      bareSpecifiers.set(specifier, resolved);
    } else if (resolved.startsWith("file://")) {
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
