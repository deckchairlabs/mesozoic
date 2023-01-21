import { instantiate } from "./swc_mesozoic.generated.js";
import { cache, toFileUrl } from "./deps.ts";

export type CompilerOptions = {
  jsxImportSource?: string;
  development?: boolean;
  minify?: boolean;
};

export async function createCompiler() {
  const file = await cache(
    new URL("./swc_mesozoic_bg.wasm", import.meta.url),
  );

  return instantiate({ url: toFileUrl(file.path) });
}

export async function compile(filename: string, source: string, options: CompilerOptions) {
  const { transform } = await createCompiler();
  try {
    return transform(
      filename,
      source,
      options.jsxImportSource || "react",
      options.development || false,
      options.minify || true,
    );
  } catch (error) {
    console.error(error);
    throw new Error(String(error));
  }
}
