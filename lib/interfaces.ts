export interface ISourceFile {
  path(): string;
  relativePath(): string;
  alias(): string | undefined;
  relativeAlias(): string | undefined;
  root(): string;
  extension(): string;
  read(): Promise<string>;
  readBytes(): Promise<Uint8Array>;
  write(content: string | Uint8Array): Promise<void>;
  copyTo(to: string, filePath?: string): Promise<ISourceFile>;
  copyToHashed(to: string): Promise<ISourceFile>;
  remove(): Promise<boolean>;
}
