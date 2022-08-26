import { join } from "./deps.ts";
import { ISource, Source } from "./source.ts";
import { SourceFile } from "./sourceFile.ts";

export class VirtualSourceFile extends Source implements ISource {
  private content: string | Uint8Array;

  constructor(
    filePath: string,
    rootPath: string,
    content: string | Uint8Array,
  ) {
    super(filePath, rootPath);
    this.content = content;
  }

  readBytes(): Promise<Uint8Array> {
    return Promise.resolve(
      typeof this.content === "string"
        ? new TextEncoder().encode(this.content)
        : this.content,
    );
  }

  async copyTo(to: string): Promise<ISource> {
    const path = join(to, this.relativePath());
    await Deno.writeFile(path, await this.readBytes());

    const source = new SourceFile(path, to);
    source.unlock();

    return source;
  }

  copyToHashed(to: string): Promise<ISource> {
    throw new Error("Method not implemented.");
  }

  remove(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}
