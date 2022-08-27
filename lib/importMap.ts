import {
  ImportMap,
  parse,
  ParsedImportMap,
  resolve,
} from "https://esm.sh/@import-maps/resolve@1.0.1";

export type { ImportMap, ParsedImportMap };

export function parseImportMap(
  importMap?: ImportMap,
  baseUrl: URL = new URL(import.meta.url),
) {
  if (!importMap) {
    return;
  }
  return parse(importMap, baseUrl);
}

export function resolveSpecifierFromImportMap(
  importMap: ParsedImportMap,
  specifier: string,
  scriptUrl: URL,
) {
  return resolve(specifier, importMap, scriptUrl);
}
