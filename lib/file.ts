import { basename, extname, join, sprintf, toFileUrl } from "./deps.ts";

export interface IFile {
  filename(): string;
  path(): string;
  relativePath(): string;
  url(): URL;
  alias(): string | undefined;
  aliasUrl(): URL | undefined;
  setAlias(alias: string): IFile;
  relativeAlias(): string | undefined;
  root(): string;
  extension(): string;
  read(): Promise<string>;
  readAsJson<T = unknown>(): Promise<T>;
  readBytes(): Promise<Uint8Array>;
  write(content: string | Uint8Array): Promise<void>;
  // deno-lint-ignore no-explicit-any
  writeJson(value: any, pretty?: boolean): Promise<void>;
  copyTo(to: string, filePath?: string): Promise<IFile>;
  copyToHashed(to: string): Promise<IFile>;
  remove(): Promise<boolean>;
  rename(newFilename: string): Promise<string>;
  clone(): IFile;
}

export abstract class File implements IFile {
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

  filename() {
    return basename(this.filePath);
  }

  path() {
    return this.filePath;
  }

  url() {
    return toFileUrl(this.filePath);
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

  aliasUrl() {
    return this.aliasPath ? toFileUrl(this.aliasPath) : undefined;
  }

  setAlias(alias: string) {
    this.aliasPath = alias;
    return this;
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

  async readAsJson<T = unknown>(
    // deno-lint-ignore no-explicit-any
    reviver?: (key: string, value: any) => any,
  ): Promise<T> {
    const content = await this.read();
    return JSON.parse(content, reviver);
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

  // deno-lint-ignore no-explicit-any
  writeJson(value: any, pretty = false) {
    const json = JSON.stringify(value, null, pretty ? 2 : undefined);
    return this.write(json);
  }

  copyTo(_to: string, _filePath?: string | undefined): Promise<IFile> {
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

  async rename(newFilename: string): Promise<string> {
    try {
      const path = this.path();
      const filename = this.filename();
      await Deno.rename(path, path.replace(filename, newFilename));

      this.filePath = path.replace(filename, newFilename);

      return newFilename;
    } catch (error) {
      throw error;
    }
  }

  clone(): IFile {
    throw new Error("Not implemented");
  }

  async copyToHashed(to: string): Promise<IFile> {
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
