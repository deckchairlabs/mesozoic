import { dirname, ensureDir, extname, join, resolve } from "./deps.ts";

export class SourceFile {
  private alias?: string;
  private locked = true;

  /**
   * @param filepath The absolute filepath to the file.
   * @param rootpath The absolute filepath to the root of this file.
   */
  constructor(
    private readonly filepath: string,
    private readonly rootpath: string,
  ) {}

  path() {
    return this.filepath;
  }

  root() {
    return this.rootpath;
  }

  /**
   * @returns The relative path of this file to its root.
   */
  relativePath() {
    return this.path().replace(this.rootpath, ".");
  }

  getExtension() {
    return extname(this.path());
  }

  /**
   * @returns The content of the file as a string.
   */
  async read() {
    return new TextDecoder().decode(await this.readBytes());
  }

  write(content: string) {
    return Deno.writeFile(this.path(), new TextEncoder().encode(content));
  }

  /**
   * @returns The content of the file as an array of bytes.
   */
  readBytes() {
    return Deno.readFile(this.path());
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
      throw new Error("cannot copy a file to itself");
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

  async copyToHashed(to: string): Promise<SourceFile> {
    const contentHash = await this.contentHash();
    const extension = this.getExtension();

    const path = this.relativePath().replace(
      extension,
      `.${contentHash}${extension}`,
    );

    const copied = await this.copyTo(to, path);
    copied.alias = join(to, this.relativePath());

    return copied;
  }

  isLocked() {
    return this.locked;
  }

  private unlock() {
    this.locked = false;

    return this;
  }

  async remove() {
    if (this.locked) {
      throw new Error("cannot remove a locked file");
    }
    try {
      await Deno.remove(this.path());
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * @param length The length of the content hash to return.
   * @returns The hash of the files content.
   */
  async contentHash(length = 8) {
    const source = await this.readBytes();
    const hashBuffer = await crypto.subtle.digest("SHA-256", source);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
      "",
    );

    return hashHex.slice(0, length);
  }

  toJSON(prefix?: string) {
    const relativePath = this.relativePath();
    return [
      this.alias ?? relativePath,
      prefix ? resolve(prefix, relativePath) : relativePath,
    ];
  }
}
