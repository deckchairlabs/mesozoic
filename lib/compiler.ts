import {
  // type JscTarget, type ParserConfig,
  transform,
} from "./swc.ts";

export type CompilerOptions = {
  jsxImportSource?: string;
  development?: boolean;
  minify?: boolean;
};

// const TS_REGEX = new RegExp(".(ts[x]?)$");
// const JSX_REGEX = new RegExp(".([jt]sx)$");

// export function resolveParserConfig(filename: string): ParserConfig {
//   const isTypescript = TS_REGEX.test(filename);
//   const isJsx = JSX_REGEX.test(filename);

//   return isTypescript
//     ? {
//       syntax: "typescript",
//       dynamicImport: true,
//       tsx: isJsx,
//     }
//     : {
//       syntax: "ecmascript",
//       jsx: isJsx,
//     };
// }

export function compile(filename: string, source: string, options: CompilerOptions) {
  // const {
  //   target = "es2022",
  //   useBuiltins = true,
  //   externalHelpers = false,
  //   jsxImportSource = "react",
  //   runtime = "automatic",
  //   development,
  //   sourceMaps,
  //   minify = true,
  //   globals = {},
  // } = options;

  // const parserConfig = resolveParserConfig(filename);

  try {
    return transform(
      filename,
      source,
      options.jsxImportSource,
      options.development || false,
      options.minify || true,
    );
    // const transformed = await transform(source, {
    //   filename,
    //   minify,
    //   jsc: {
    //     target,
    //     parser: parserConfig,
    //     externalHelpers,
    //     minify: minify
    //       ? {
    //         mangle: true,
    //         compress: true,
    //       }
    //       : undefined,
    //     transform: {
    //       react: {
    //         useBuiltins,
    //         importSource: jsxImportSource,
    //         runtime,
    //         development,
    //       },
    //       optimizer: {
    //         simplify: true,
    //         globals: {
    //           vars: globals,
    //         },
    //       },
    //     },
    //   },
    //   sourceMaps: sourceMaps ? true : undefined,
    //   inlineSourcesContent: true,
    // });

    // return transformed;
  } catch (error) {
    console.error(error);
    throw new Error(String(error));
  }
}
