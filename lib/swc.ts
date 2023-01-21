import { instantiate } from "./swc_mesozoic.generated.js";
import { cache, toFileUrl } from "./deps.ts";

const file = await cache(
  new URL("./swc_mesozoic_bg.wasm", import.meta.url),
);

const instance = await instantiate({ url: toFileUrl(file.path) });
// const instance = await instantiate();

export const transform = instance.transform;
