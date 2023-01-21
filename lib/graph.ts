import { init } from "https://deno.land/x/deno_graph@0.41.0/mod.ts";
export { createGraph } from "https://deno.land/x/deno_graph@0.41.0/mod.ts";
import { cache, toFileUrl } from "./deps.ts";

const file = await cache(
  "https://deno.land/x/deno_graph@0.41.0/lib/deno_graph_bg.wasm",
);

await init({ url: toFileUrl(file.path) });
