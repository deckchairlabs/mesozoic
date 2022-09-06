import type { JscTarget } from "./swc.ts";
import { transform } from "./swc.ts";

export type CompilerOptions = {
  filename?: string;
  target?: JscTarget;
  useBuiltins?: boolean;
  externalHelpers?: boolean;
  dynamicImport?: boolean;
  jsxImportSource?: string;
  runtime?: "automatic" | "classic" | undefined;
  development?: boolean;
  sourceMaps?: boolean;
  minify?: boolean;
};

export async function compile(source: string, options: CompilerOptions) {
  const {
    filename,
    target = "es2022",
    useBuiltins = true,
    externalHelpers = true,
    dynamicImport = true,
    jsxImportSource = "react",
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
          importSource: jsxImportSource,
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
