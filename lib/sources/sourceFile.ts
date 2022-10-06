import { dirname, ensureDir, join, sprintf } from "../deps.ts";
import { File, IFile } from "./file.ts";

export class SourceFile extends File implements IFile {
  /**
   * @param filePath The absolute or relative filepath to the file.
   * @param rootPath The absolute filepath to the root of this file.
   */
  constructor(filePath: string, rootPath: string) {
    super(filePath, rootPath);
  }

  /**
   * @param to The absolute path to copy the file to.
   * @returns An unlocked source file of the copied file.
   */
  async copyTo(
    to: string,
    filepath = this.relativePath(),
  ): Promise<SourceFile> {
    const destination = join(to, filepath);

    if (destination === this.path()) {
      throw new Error(sprintf("cannot copy a file to itself: %s", this.path()));
    }

    await ensureDir(dirname(destination));
    await Deno.copyFile(this.path(), destination);

    const sourceFile = new SourceFile(destination, to);

    /**
     * This file has been copied, so we can safely unlock it.
     */
    sourceFile.unlock();

    return sourceFile;
  }

  clone(): SourceFile {
    return new SourceFile(this.path(), this.root());
  }
}
