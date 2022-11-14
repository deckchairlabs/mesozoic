import { dirname, ensureDir, join } from "../deps.ts";
import { File, IFile } from "./file.ts";
import { SourceFile } from "./sourceFile.ts";

const encoder = new TextEncoder();

export class VirtualFile extends File implements IFile {
  private content: string | Uint8Array;

  constructor(
    filePath: string,
    rootPath: string,
    content: string | Uint8Array,
  ) {
    super(filePath, rootPath);
    this.content = content;
    this.unlock();
  }

  readBytes(): Promise<Uint8Array> {
    return Promise.resolve(
      typeof this.content === "string" ? encoder.encode(this.content) : this.content,
    );
  }

  async copyTo(to: string): Promise<IFile> {
    const path = join(to, this.relativePath());
    await ensureDir(dirname(path));

    await Deno.writeFile(path, await this.readBytes(), {
      create: true,
    });

    const source = new SourceFile(path, to);
    source.unlock();

    return source;
  }

  remove(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}
