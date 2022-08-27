import { IFile } from "./file.ts";
import { SourceFile } from "./sourceFile.ts";
import { ModuleGraph } from "./types.ts";

export class EntrypointFile extends SourceFile implements IFile {
  constructor(
    filePath: string,
    rootPath: string,
    public moduleGraph?: ModuleGraph,
  ) {
    super(filePath, rootPath);
  }

  setModuleGraph(moduleGraph: ModuleGraph) {
    this.moduleGraph = moduleGraph;
    return this;
  }
}
