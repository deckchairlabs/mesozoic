import { transform } from "./swc.ts";
import { Target } from "./types.ts";

export type CompilerOptions = {
  target?: Target;
  globals?: {
    [key: string]: string;
  };
  filename?: string;
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
    target = "browser",
    useBuiltins = true,
    externalHelpers = false,
    dynamicImport = true,
    jsxImportSource = "react",
    runtime = "automatic",
    development,
    sourceMaps,
    minify = true,
    globals = undefined,
  } = options;

  const transformed = await transform(source, {
    filename,
    minify,
    jsc: {
      target: "es2022",
      parser: {
        syntax: "typescript",
        dynamicImport,
        tsx: true,
      },
      externalHelpers,
      minify: minify
        ? {
          mangle: true,
          compress: true,
        }
        : undefined,
      transform: {
        react: {
          useBuiltins,
          importSource: jsxImportSource,
          runtime,
          development,
        },
        optimizer: {
          simplify: true,
          globals: {
            vars: globals,
            // @ts-ignore missing type in GlobalPassOption
            typeofs: {
              "Deno": target === "browser" ? "undefined" : "object",
            },
          },
        },
      },
    },
    sourceMaps: sourceMaps ? true : undefined,
    inlineSourcesContent: true,
  });

  return transformed;
}
