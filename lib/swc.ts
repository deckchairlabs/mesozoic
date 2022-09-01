import init from "https://esm.sh/@swc/wasm-web@1.2.246/wasm-web.js";
export {
  parse,
  print,
  transform,
} from "https://esm.sh/@swc/wasm-web@1.2.246/wasm-web.js";
export type { JscTarget } from "https://esm.sh/@swc/core@1.2.246/types.d.ts";
export { Visitor } from "https://esm.sh/@swc/core@1.2.246/Visitor.js";
export * as Types from "https://esm.sh/v92/@swc/core@1.2.246/types.d.ts";
import { cache, toFileUrl } from "./deps.ts";

const file = await cache(
  "https://esm.sh/@swc/wasm-web@1.2.246/wasm-web_bg.wasm",
);

await init(toFileUrl(file.path));
