import init, {
  transform,
} from "https://esm.sh/@swc/wasm-web@1.2.242/wasm-web.js";
import type { JscTarget } from "https://esm.sh/@swc/core@1.2.242/types.d.ts";
import { cache } from "https://deno.land/x/cache@0.2.13/mod.ts";
import { toFileUrl } from "./deps.ts";

const file = await cache(
  "https://esm.sh/@swc/wasm-web@1.2.242/wasm-web_bg.wasm",
);

await init(toFileUrl(file.path));

export type CompilerOptions = {
  filename?: string;
  target?: JscTarget;
  useBuiltins?: boolean;
  externalHelpers?: boolean;
  dynamicImport?: boolean;
  importSource?: string;
  runtime?: "automatic" | "classic" | undefined;
  development?: boolean;
  sourceMaps?: boolean;
  minify?: boolean;
};

export async function compile(source: string, options: CompilerOptions) {
  const {
    filename,
    target = "es2020",
    useBuiltins = true,
    externalHelpers = true,
    dynamicImport = true,
    importSource = "react",
    runtime = "automatic",
    development,
    sourceMaps,
    minify,
  } = options;

  const transformed = await transform(source, {
    // @ts-ignore This exists in the Rust API, but isn't exposed on the config type for some reason
    filename,
    jsc: {
      target,
      parser: {
        syntax: "typescript",
        dynamicImport,
        tsx: true,
      },
      externalHelpers,
      transform: {
        react: {
          useBuiltins,
          importSource,
          runtime,
          development,
        },
      },
    },
    sourceMaps: sourceMaps ? true : undefined,
    inlineSourcesContent: true,
    minify,
  });

  return transformed;
}
