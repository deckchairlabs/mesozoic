import { IFile } from "./file.ts";
import { ImportMap } from "./importMap.ts";
import { SourceFile } from "./sourceFile.ts";
import { ModuleGraph } from "./types.ts";

export type EntrypointTarget = "browser" | "deno";

export type EntrypointConfig = {
  /**
   * The output directory for the vendored dependencies
   * of this entrypoint, relative to the vendor output directory.
   */
  vendorOutputDir: string;
  target: EntrypointTarget;
};

export class Entrypoint extends SourceFile implements IFile {
  public bareImportSpecifiers: Map<string, string> = new Map();
  public importMap: ImportMap = {};

  constructor(
    filePath: string,
    rootPath: string,
    public config?: EntrypointConfig,
    public moduleGraph?: ModuleGraph,
  ) {
    super(filePath, rootPath);
  }

  setModuleGraph(moduleGraph: ModuleGraph) {
    this.moduleGraph = moduleGraph;
    return this;
  }

  setBareImportSpecifiers(specifiers: Map<string, string>) {
    this.bareImportSpecifiers = specifiers;
  }

  setImportMap(importMap: ImportMap) {
    this.importMap = importMap;
  }
}
