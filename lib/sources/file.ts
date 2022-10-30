import { basename, dirname, extname, sprintf } from "../deps.ts";
import { Path } from "./path.ts";

export interface IFile {
  filename(): string;
  dirname(): string;
  path(): string;
  originalPath(): Path;
  relativePath(): string;
  url(): URL;
  root(): string;
  extension(): string;
  read(): Promise<string>;
  readAsJson<T = unknown>(): Promise<T>;
  readBytes(): Promise<Uint8Array>;
  write(content: string | Uint8Array, overwrite?: boolean): Promise<void>;
  // deno-lint-ignore no-explicit-any
  writeJson(value: any, pretty?: boolean): Promise<void>;
  copyTo(to: string, filePath?: string): Promise<IFile>;
  remove(): Promise<boolean>;
  rename(newFilename: string): Promise<string>;
  clone(): IFile;
  contentHash(): Promise<string>;
}

export abstract class File implements IFile {
  #path: Path;
  private locked = true;
  private originalFilePaths: Set<string> = new Set();

  constructor(filePath: string, rootPath: string) {
    this.#path = new Path(filePath, rootPath);
    this.originalFilePaths.add(this.#path.path());
  }

  isLocked() {
    return this.locked;
  }

  unlock() {
    this.locked = false;
    return this;
  }

  filename() {
    return basename(this.path());
  }

  dirname() {
    return dirname(this.path());
  }

  path() {
    return this.#path.path();
  }

  originalPath() {
    const [originalPath] = this.originalFilePaths;
    return new Path(originalPath, this.root());
  }

  url() {
    return this.#path.url();
  }

  /**
   * @returns The relative path of this file to its root.
   */
  relativePath() {
    return this.#path.relativePath();
  }

  root() {
    return this.#path.root();
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

  write(content: string | Uint8Array, overwrite = false) {
    if (this.isLocked() && !overwrite) {
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

      this.#path = new Path(path.replace(filename, newFilename), this.root());
      this.originalFilePaths.add(path);

      return newFilename;
    } catch (error) {
      throw error;
    }
  }

  clone(): IFile {
    throw new Error("Not implemented");
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
