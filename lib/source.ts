import { extname, join, sprintf } from "./deps.ts";

export interface ISource {
  path(): string;
  relativePath(): string;
  alias(): string | undefined;
  setAlias(alias: string): void;
  relativeAlias(): string | undefined;
  root(): string;
  extension(): string;
  read(): Promise<string>;
  readBytes(): Promise<Uint8Array>;
  write(content: string | Uint8Array): Promise<void>;
  copyTo(to: string, filePath?: string): Promise<ISource>;
  copyToHashed(to: string): Promise<ISource>;
  remove(): Promise<boolean>;
}

export abstract class Source implements ISource {
  private aliasPath?: string;
  private locked = true;

  constructor(public filePath: string, public rootPath: string) {}

  isLocked() {
    return this.locked;
  }

  unlock() {
    this.locked = false;
    return this;
  }

  path() {
    return this.filePath;
  }

  /**
   * @returns The relative path of this file to its root.
   */
  relativePath() {
    return this.path().replace(this.rootPath, ".");
  }

  alias() {
    return this.aliasPath;
  }

  setAlias(alias: string): void {
    this.aliasPath = alias;
  }

  relativeAlias() {
    return this.alias()?.replace(this.rootPath, ".");
  }

  root() {
    return this.rootPath;
  }

  extension() {
    return extname(this.path());
  }

  async read() {
    return new TextDecoder().decode(await this.readBytes());
  }

  /**
   * @returns The content of the file as an array of bytes.
   */
  readBytes() {
    return Deno.readFile(this.path());
  }

  write(content: string | Uint8Array) {
    if (this.isLocked()) {
      throw new Error(
        sprintf("cannot write file because it is locked: %s", this.path()),
      );
    }

    const bytes = typeof content === "string"
      ? new TextEncoder().encode(content)
      : content;

    return Deno.writeFile(this.path(), bytes);
  }

  copyTo(_to: string, _filePath?: string | undefined): Promise<ISource> {
    throw new Error("Method not implemented.");
  }

  async remove(): Promise<boolean> {
    if (this.isLocked()) {
      throw new Error(sprintf("cannot remove a locked file: %s", this.path()));
    }
    try {
      await Deno.remove(this.path());
      return true;
    } catch (error) {
      throw error;
    }
  }

  async copyToHashed(to: string): Promise<ISource> {
    const contentHash = await this.contentHash();
    const extension = this.extension();

    const path = this.relativePath().replace(
      extension,
      `.${contentHash}${extension}`,
    );

    const copied = await this.copyTo(to, path);
    copied.setAlias(join(to, this.relativePath()));

    return copied;
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
}
