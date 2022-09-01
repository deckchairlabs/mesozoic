import {
  parse,
  print,
  Types,
  Visitor
} from "./swc.ts";

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
  visitIfStatement(statement: Types.IfStatement): Types.Statement {
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
  visitTsType(type: Types.TsType): Types.TsType {
    return type;
  }
}
