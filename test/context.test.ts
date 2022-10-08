import { assertEquals, assertThrows } from "./deps.ts";
import { BuildContext, BuildContextBuilder } from "../lib/context.ts";

Deno.test("it works", () => {
  const buildContext = new BuildContextBuilder();

  const context: BuildContext = buildContext
    .setRoot(import.meta.resolve("./"))
    .setOutput(import.meta.resolve("./.build"))
    .setImportMapPath("./importMap.json")
    .ignore("./private.txt")
    .contentHash("./*.css")
    .build();

  assertEquals(context.root === undefined, false);
  assertEquals(context.output === undefined, false);
  assertEquals(context.ignored.test("./private.txt"), true);
  assertEquals(context.hashed.test("./test.css"), true);
});

Deno.test("it should throw when not valid", () => {
  const buildContext = new BuildContextBuilder();
  assertThrows(() => buildContext.valid());
  assertThrows(() => buildContext.build());
});
