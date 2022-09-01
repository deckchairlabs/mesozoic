import { assertEquals } from "./deps.ts";
import { stripMesozoicConditionals } from "../lib/strip.ts";

Deno.test("it works", { ignore: true }, async () => {
  const source = `
    import React from 'react';
    if (__MESOZOIC_BUILD__) {
      console.log('removed')
      console.log(React)
    } else {
      console.log('not removed')
    }
    if (__MESOZOIC_BUILD__) {
      const {default: compiler} = await import('./compiler.ts');
    }
  `;

  const result = await stripMesozoicConditionals(source);

  assertEquals(result.includes("React"), false);
  assertEquals(result.includes("console.log('removed')"), false);
  assertEquals(
    result.includes("compiler"),
    false,
  );
  assertEquals(result.includes("console.log('not removed')"), true);
});
