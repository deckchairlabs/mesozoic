import init, {
  parse,
  print,
} from "https://esm.sh/@swc/wasm-web@1.2.242/wasm-web.js";
import { Visitor } from "https://esm.sh/@swc/core@1.2.242/Visitor.js";
import { cache } from "https://deno.land/x/cache@0.2.13/mod.ts";
import { toFileUrl } from "./deps.ts";
import {
  IfStatement,
  Statement,
  TsType,
} from "https://esm.sh/v92/@swc/core@1.2.242/types.d.ts";

const file = await cache(
  "https://esm.sh/@swc/wasm-web@1.2.242/wasm-web_bg.wasm",
);

await init(toFileUrl(file.path));

export async function stripMesozoicConditionals(
  content: string,
  minify?: boolean,
) {
  const parsed = await parse(content, {
    syntax: "typescript",
    tsx: true,
    target: "es2022",
    dynamicImport: true,
  });

  const stripped = new Stripper().visitProgram(parsed);
  const result = await print(stripped, {
    minify,
    jsc: {
      parser: {
        syntax: "ecmascript",
      },
    },
  });

  return result.code;
}

class Stripper extends Visitor {
  visitIfStatement(statement: IfStatement): Statement {
    if (
      statement.test.type === "Identifier" &&
      statement.test.value === "__MESOZOIC_BUILD__"
    ) {
      if (statement.alternate) {
        return statement.alternate;
      }
      return {
        type: "EmptyStatement",
        span: statement.span,
      };
    }
    return super.visitIfStatement(statement);
  }
  visitTsType(type: TsType): TsType {
    return type;
  }
}
