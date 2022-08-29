import {
  parse,
  resolve as importMapResolve,
} from "https://esm.sh/@import-maps/resolve@1.0.1";
import { sprintf } from "../deps.ts";
import { FileBag } from "../fileBag.ts";
import { ImportMap, ResolveResult } from "../types.ts";
import { isBareSpecifier } from "./specifiers.ts";

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

    if (isBareSpecifier(resolved)) {
      const importMapResolved = importMapResolve(
        specifier,
        parsedImportMap,
        new URL(referrer),
      );

      if (importMapResolved.matched) {
        resolved = importMapResolved.resolvedImport.href;
        bareSpecifiers.set(specifier, resolved);
      }
    } else if (resolved.startsWith("file://")) {
      const path = resolved.replace(referrer, "./");

      const source = sources.find((source) =>
        source.relativePath() === path ||
        source.relativeAlias() === path
      );

      if (source) {
        resolved = source.path();
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
      resolvedSpecifier = specifier;
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
