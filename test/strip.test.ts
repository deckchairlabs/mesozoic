import { assertEquals } from "./deps.ts";
import {
  parseExpressionStatement,
  stripConditionalIfStatements,
} from "../lib/strip.ts";
import { assertNotEquals } from "https://deno.land/std@0.153.0/testing/asserts.ts";

Deno.test("it works", async () => {
  const source = `
    import React from 'react';
    if (__DEV__) {
      console.log('removed')
      console.log(React)
    } else {
      console.log('not removed')
    }
    if (__DEV__) {
      const {default: compiler} = await import('./compiler.ts');
    }
  `;

  const result = await stripConditionalIfStatements(
    source,
    "__DEV__",
  );

  assertEquals(result.includes("React"), true);
  assertEquals(result.includes("__DEV__"), false);
  assertEquals(result.includes("console.log('removed')"), false);
  assertEquals(
    result.includes("compiler"),
    false,
  );
  assertEquals(result.includes("console.log('not removed')"), true);
});

Deno.test("it can parse expression statements", async () => {
  const statement = "mode === 'development'";
  const parsed = await parseExpressionStatement(statement);

  assertNotEquals(parsed, undefined);

  assertEquals(parsed!.type, "ExpressionStatement");
  assertEquals(parsed!.expression.type, "BinaryExpression");
});
