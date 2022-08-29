import { assertEquals } from "./deps.ts";
import { stripMesozoicConditionals } from "../lib/strip.ts";

Deno.test("it works", async () => {
  const source = `
    if (__MESOZOIC_BUILD__) {
      console.log('removed')
    } else {
      console.log('not removed')
    }
    if (__MESOZOIC_BUILD__) {
      const {default: compiler} = await import('./compiler.ts');
    }
  `;

  const result = await stripMesozoicConditionals(source);

  assertEquals(result.includes("console.log('removed')"), false);
  assertEquals(
    result.includes(
      "const {default: compiler} = await import('./compiler.ts');",
    ),
    false,
  );
  assertEquals(result.includes("console.log('not removed')"), true);
});
