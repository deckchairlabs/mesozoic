import { ImportMap, ParsedImportMap } from "./types.ts";
import { importMapResolve, parseImportMap } from "./deps.ts";

export class ImportMapResolver {
  private parsedImportMap: ParsedImportMap;

  constructor(importMap: ImportMap, baseURL: URL) {
    this.parsedImportMap = parseImportMap(importMap, baseURL);
  }

  resolve(specifier: string, scriptURL: URL) {
    return importMapResolve(specifier, this.parsedImportMap, scriptURL);
  }
}
