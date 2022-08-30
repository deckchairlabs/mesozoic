import { FileBag } from "../lib/sources/fileBag.ts";
import { assertEquals } from "./deps.ts";

Deno.test("constructor", () => {
  const fileBag = new FileBag();
  assertEquals(fileBag.size, 0);
});
