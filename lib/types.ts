import type { ModuleJson } from "https://deno.land/x/deno_graph@0.32.0/lib/types.d.ts";

export type { ModuleJson };

type Records = Record<string, string>;

export type ImportMap = {
  imports?: Records;
  scopes?: Record<string, Records>;
};

export type ModuleGraph = {
  roots: Set<string>;
  modules: Map<string, ModuleJson>;
};
