import { SourceFileBag } from "../lib/sourceFileBag.ts";
import { assertEquals } from "./deps.ts";

Deno.test("constructor", () => {
  const fileBag = new SourceFileBag();
  assertEquals(fileBag.size, 0);
});
