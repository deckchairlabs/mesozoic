import { IFile } from "./sources/file.ts";
import { SourceFile } from "./sources/sourceFile.ts";
import type { Target } from "./types.ts";

export type EntrypointConfig = {
  path: string;
  target: Target;
};

export class Entrypoint extends SourceFile implements IFile {
  constructor(
    filePath: string,
    rootPath: string,
    public name: string,
    public config: EntrypointConfig,
  ) {
    super(filePath, rootPath);
  }
}
