import { type JscTarget, type ParserConfig, transform } from "./swc.ts";

export type CompilerOptions = {
  filename: string;
  globals?: {
    [key: string]: string;
  };
  target?: JscTarget;
  useBuiltins?: boolean;
  externalHelpers?: boolean;
  jsxImportSource?: string;
  runtime?: "automatic" | "classic" | undefined;
  development?: boolean;
  sourceMaps?: boolean;
  minify?: boolean;
};

const TS_REGEX = new RegExp(".(ts[x]?)$");
const JSX_REGEX = new RegExp(".([jt]sx)$");

export function resolveParserConfig(filename: string): ParserConfig {
  const isTypescript = TS_REGEX.test(filename);
  const isJsx = JSX_REGEX.test(filename);

  return isTypescript
    ? {
      syntax: "typescript",
      dynamicImport: true,
      tsx: isJsx,
    }
    : {
      syntax: "ecmascript",
      jsx: isJsx,
    };
}

export async function compile(source: string, options: CompilerOptions) {
  const {
    filename,
    target = "es2022",
    useBuiltins = true,
    externalHelpers = false,
    jsxImportSource = "react",
    runtime = "automatic",
    development,
    sourceMaps,
    minify = true,
    globals = undefined,
  } = options;

  const parserConfig = resolveParserConfig(filename);

  try {
    const transformed = await transform(source, {
      filename,
      minify,
      jsc: {
        target,
        parser: parserConfig,
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
            },
          },
        },
      },
      sourceMaps: sourceMaps ? true : undefined,
      inlineSourcesContent: true,
    });

    return transformed;
  } catch (error) {
    throw new Error(String(error));
  }
}
