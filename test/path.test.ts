import { Path } from "../lib/sources/path.ts";
import { assertEquals } from "./deps.ts";

Deno.test("it works", () => {
  const path = new Path("./test.ts", "/testing");
  assertEquals(path.relativePath(), "./test.ts");
  assertEquals(path.root(), "/testing");
  assertEquals(path.path(), "/testing/test.ts");
});
