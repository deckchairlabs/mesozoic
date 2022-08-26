import { extname, join } from "./deps.ts";
import { ISourceFile } from "./interfaces.ts";
import { SourceFile } from "./sourceFile.ts";

export class VirtualSourceFile implements ISourceFile {
  private filePath: string;
  private rootPath: string;
  private aliasPath?: string;
  private content: string | Uint8Array;

  constructor(
    filePath: string,
    rootPath: string,
    content: string | Uint8Array,
  ) {
    this.rootPath = rootPath;
    this.filePath = join(this.rootPath, filePath);
    this.content = content;
  }

  path(): string {
    return this.filePath;
  }

  /**
   * @returns The relative path of this file to its root.
   */
  relativePath() {
    return this.path().replace(this.rootPath, ".");
  }

  alias(): string | undefined {
    return this.aliasPath;
  }

  relativeAlias(): string | undefined {
    return this.alias()?.replace(this.rootPath, ".");
  }

  root(): string {
    return this.rootPath;
  }

  extension(): string {
    return extname(this.path());
  }

  read(): Promise<string> {
    return Promise.resolve(
      typeof this.content === "string"
        ? this.content
        : new TextDecoder().decode(this.content),
    );
  }

  readBytes(): Promise<Uint8Array> {
    return Promise.resolve(
      typeof this.content === "string"
        ? new TextEncoder().encode(this.content)
        : this.content,
    );
  }

  write(content: string | Uint8Array): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async copyTo(to: string): Promise<ISourceFile> {
    const path = join(to, this.relativePath());
    await Deno.writeFile(path, await this.readBytes());

    return new SourceFile(path, to);
  }

  copyToHashed(to: string): Promise<ISourceFile> {
    throw new Error("Method not implemented.");
  }

  remove(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}
