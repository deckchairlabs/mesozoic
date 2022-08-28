import {
  parse,
  resolve as importMapResolve,
} from "https://esm.sh/@import-maps/resolve@1.0.1";
import { sprintf } from "../deps.ts";
import { FileBag } from "../fileBag.ts";
import { ImportMap, ResolveResult } from "../types.ts";

export function createResolver(
  importMap: ImportMap,
  sources: FileBag,
  bareSpecifiers: Map<string, string>,
  baseUrl: URL,
) {
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
      }
    }

    return resolved;
  };
}

export function resolve(specifier: string, referrer: string) {
  let resolvedSpecifier: string | ResolveResult = specifier;

  try {
    const url = new URL(specifier, referrer);
    if (isBareSpecifier(specifier)) {
      resolvedSpecifier = specifier;
    } else {
      resolvedSpecifier = url.href;
    }
  } catch {
    throw new Error(
      sprintf("could not resolve %s from %s", specifier, referrer),
    );
  }

  // if (specifier.startsWith("./") || specifier.startsWith("../")) {
  //   // Resolve a relative local file
  //   if (referrer.startsWith("file://")) {
  //     resolvedSpecifier = fromFileUrl(new URL(specifier, referrer).href)
  //       .replace(
  //         builder.context.output,
  //         ".",
  //       );
  //     resolvedSpecifier = resolveSourceSpecifier(
  //       localSources,
  //       resolvedSpecifier,
  //     );
  //   } else {
  //     const url = prepareRemoteUrl(new URL(specifier, referrer));
  //     resolvedSpecifier = url.href;
  //   }
  // } else if (
  //   isRemoteSpecifier(specifier) ||
  //   (specifier.startsWith("/") && isRemoteSpecifier(referrer))
  // ) {
  //   const url = prepareRemoteUrl(new URL(specifier, referrer));
  //   bareSpecifiers.set(specifier, url.href);
  //   resolvedSpecifier = url.href;
  // } else {
  //   // Bare import specifier
  //   const resolved = builder.resolveImportSpecifier(
  //     specifier,
  //     new URL(referrer),
  //   );
  //   if (resolved && resolved.matched) {
  //     resolvedSpecifier = resolved.resolvedImport.href;
  //     bareSpecifiers.set(resolvedSpecifier, specifier);
  //   }
  // }

  // builder.log.debug(
  //   sprintf(
  //     "%s %s to %s",
  //     crayon.green("Resolved"),
  //     specifier,
  //     resolvedSpecifier,
  //   ),
  // );

  return resolvedSpecifier;
}

export function isBareSpecifier(specifier: string) {
  return [
    specifier.startsWith("./"),
    specifier.startsWith("../"),
    specifier.startsWith("http://"),
    specifier.startsWith("https://"),
    specifier.startsWith("file://"),
  ].every((condition) => condition === false);
}

export function isRelativeSpecifier(specifier: string) {
  return [
    specifier.startsWith("./"),
    specifier.startsWith("../"),
  ].every((condition) => condition === true);
}
