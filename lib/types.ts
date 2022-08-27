import type { ModuleJson } from "https://deno.land/x/deno_graph@0.32.0/lib/types.d.ts";
import type { ImportMap } from "./importMap.ts";

export type { ImportMap, ModuleJson };

type Module = {
  dependencies: Set<string>;
  source: string;
};

export type ModuleGraph = {
  roots: Set<string>;
  modules: Map<string, Module>;
};
