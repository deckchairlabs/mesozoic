import { IFile } from "./sources/file.ts";
import { SourceFile } from "./sources/sourceFile.ts";
import type { Target } from "./types.ts";

export type EntrypointConfig = {
  path: string;
  target: Target;
};

export class Entrypoint extends SourceFile implements IFile {
  constructor(
    public name: string,
    public config: EntrypointConfig,
    filePath: string,
    rootPath: string,
  ) {
    super(filePath, rootPath);
  }
}
