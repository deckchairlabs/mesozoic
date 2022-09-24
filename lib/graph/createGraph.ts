import {
  createGraph as denoCreateGraph,
} from "https://deno.land/x/deno_graph@0.32.0/mod.ts";

import { Loader } from "./load.ts";
import { Resolver } from "./resolve.ts";

export function createGraph(
  entrypoint: string,
  load: Loader,
  resolve: Resolver,
  kind: "codeOnly" | "all" = "codeOnly",
  jsxImportSource = "react",
) {
  /**
   * Create a Module Graph for the provided entrypoint
   */
  return denoCreateGraph(entrypoint, {
    kind,
    defaultJsxImportSource: jsxImportSource,
    load,
    resolve,
  });
}
