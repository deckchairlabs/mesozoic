import init from "https://esm.sh/@swc/wasm-web@1.3.9/wasm-web.js";
export {
  parse,
  print,
  transform,
} from "https://esm.sh/@swc/wasm-web@1.3.9/wasm-web.js";
export type {
  JscTarget,
  ParserConfig,
} from "https://esm.sh/@swc/wasm-web@1.3.9/wasm-web.js";
export { Visitor } from "https://esm.sh/@swc/core@1.3.9/Visitor.js";
export * as Types from "https://esm.sh/@swc/core@1.3.9/types.d.ts";
import { cache, toFileUrl } from "./deps.ts";

const file = await cache(
  "https://esm.sh/@swc/wasm-web@1.3.9/wasm-web_bg.wasm",
);

await init(toFileUrl(file.path));
