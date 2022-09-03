import { parse, print, Types } from "./swc.ts";
import { ConditionalExpressionStripperVisitor } from "./visitor/conditionaExpressionStripper.ts";

export async function stripConditionalIfStatements(
  content: string,
  conditional: string,
  minify?: boolean,
) {
  const parsedConditional = await parseExpressionStatement(conditional);

  const parsed = await parse(content, {
    syntax: "typescript",
    tsx: true,
    target: "es2022",
    dynamicImport: true,
  });

  const stripped = new ConditionalExpressionStripperVisitor(parsedConditional)
    .visitProgram(
      parsed,
    );

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

export async function parseExpressionStatement(
  statement: string,
): Promise<Types.ExpressionStatement | undefined> {
  const parsed = await parse(statement, {
    syntax: "ecmascript",
    script: true,
    jsx: false,
  });

  if (parsed.body && parsed.body[0].type === "ExpressionStatement") {
    return parsed.body[0];
  }
}
