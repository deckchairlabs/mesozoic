import type { ModuleJson } from "https://deno.land/x/deno_graph@0.32.0/lib/types.d.ts";
import type { ImportMap } from "./importMap.ts";

export type { ImportMap, ModuleJson };

export type ModuleGraph = {
  roots: Set<string>;
  modules: Map<string, Set<string>>;
};
