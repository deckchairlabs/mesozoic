import { FileBag } from "./sources/fileBag.ts";

export type {
  LoadResponse,
  ModuleGraph,
  ResolveResult,
} from "https://deno.land/x/deno_graph@0.32.0/lib/types.d.ts";

export type { GlobToRegExpOptions } from "https://deno.land/std@0.153.0/path/glob.ts";

export type {
  ImportMap,
  ParsedImportMap,
} from "https://esm.sh/@import-maps/resolve@1.0.1";

export type SourceProcessor = (
  sources: FileBag,
) => Promise<FileBag> | FileBag;

export type Target = "browser" | "deno";
