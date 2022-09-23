import { parse, transform } from "./swc.ts";
import { Target } from "./types.ts";

type OptimizeOptions = {
  minify?: boolean;
  target?: Target;
  globals?: {
    [key: string]: string;
  };
};

export async function optimize(
  content: string,
  options: OptimizeOptions = {},
) {
  const {
    minify = true,
    target = "browser",
    globals = undefined,
  } = options;

  const parsed = await parse(content, {
    syntax: "typescript",
    tsx: true,
    target: "es2022",
    dynamicImport: true,
  });

  const transformed = await transform(parsed, {
    minify,
    module: {
      type: "es6",
      importInterop: "none",
    },
    jsc: {
      parser: {
        syntax: "ecmascript",
        jsx: true,
        importAssertions: true,
      },
      externalHelpers: false,
      transform: {
        react: {
          importSource: "react",
          runtime: "automatic",
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
  });

  return transformed.code;
}
