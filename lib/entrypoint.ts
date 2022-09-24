import { IFile } from "./sources/file.ts";
import { SourceFile } from "./sources/sourceFile.ts";
import type { Target } from "./types.ts";

export type EntrypointConfig = {
  /**
   * The output directory for the vendored dependencies
   * of this entrypoint, relative to the vendor output directory.
   */
  vendorOutputDir: string;
  target: Target;
};

export class Entrypoint extends SourceFile implements IFile {
  constructor(
    filePath: string,
    rootPath: string,
    public config: EntrypointConfig,
  ) {
    super(filePath, rootPath);
  }
}
