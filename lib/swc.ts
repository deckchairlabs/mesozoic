import init from "https://esm.sh/v103/@swc/wasm-web@1.3.27/wasm-web.js";
export { transform } from "https://esm.sh/v103/@swc/wasm-web@1.3.27/wasm-web.js";
export type { JscTarget, ParserConfig } from "https://esm.sh/v103/@swc/wasm-web@1.3.27/wasm-web.js";
export { Visitor } from "https://esm.sh/v103/@swc/core@1.3.27/Visitor.js";
export * as Types from "https://esm.sh/v103/@swc/core@1.3.27/types.d.ts";
import { cache, toFileUrl } from "./deps.ts";

const file = await cache(
  "https://esm.sh/@swc/wasm-web@1.3.27/wasm-web_bg.wasm",
);

await init(toFileUrl(file.path));
