import { instantiate } from "./swc_mesozoic.generated.js";
export type { JscTarget, ParserConfig } from "https://esm.sh/v103/@swc/wasm-web@1.3.27/wasm-web.js";
export { Visitor } from "https://esm.sh/v103/@swc/core@1.3.27/Visitor.js";
export * as Types from "https://esm.sh/v103/@swc/core@1.3.27/types.d.ts";
import { cache, toFileUrl } from "./deps.ts";

const file = await cache(
  new URL("./swc_mesozoic_bg.wasm", import.meta.url),
);

// const instance = await instantiate({ url: toFileUrl(file.path) });
const instance = await instantiate();

export const transform = instance.transform;
