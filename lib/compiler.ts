import { instantiate } from "./swc_mesozoic.generated.js";
import { cache, RELOAD_POLICY, toFileUrl } from "./deps.ts";
import type { Policy } from "./types.ts";
import { VERSION } from "../version.ts";

export type CompilerOptions = {
  jsxImportSource?: string;
  development?: boolean;
  minify?: boolean;
};

export async function createCompiler() {
  const url = new URL("./swc_mesozoic_bg.wasm", import.meta.url);
  const policy: Policy | undefined = url.protocol === "file:"
    ? RELOAD_POLICY
    : undefined;

  const file = await cache(
    url,
    policy,
    `mesozoic-${VERSION}`,
  );

  return instantiate({ url: toFileUrl(file.path) });
}

export async function compile(
  filename: string,
  source: string,
  options: CompilerOptions,
) {
  const { transform } = await createCompiler();
  try {
    return transform(
      filename,
      source,
      options.jsxImportSource || "react",
      options.development ?? false,
      options.minify ?? true,
    );
  } catch (error) {
    console.error(error);
    throw new Error(String(error));
  }
}
