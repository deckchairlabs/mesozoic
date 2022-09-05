import { normalize, walk } from "../deps.ts";
import { FileBag } from "./fileBag.ts";
import { SourceFile } from "./sourceFile.ts";

export async function gatherSources(from: string) {
  const sources = new FileBag();

  for await (const entry of walk(from)) {
    if (entry.isFile) {
      const sourceFile = new SourceFile(normalize(entry.path), from);
      sources.add(sourceFile);
    }
  }

  return sources;
}
