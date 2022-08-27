import { FileBag } from "../lib/fileBag.ts";
import { assertEquals } from "./deps.ts";

Deno.test("constructor", () => {
  const fileBag = new FileBag();
  assertEquals(fileBag.size, 0);
});
