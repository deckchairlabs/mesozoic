import { FileBag } from "../lib/sources/fileBag.ts";
import { assertEquals, join } from "./deps.ts";

Deno.test("constructor", () => {
  const fileBag = new FileBag();
  assertEquals(fileBag.size, 0);
});

Deno.test("matches", async () => {
  const fileBag = await FileBag.from(join(Deno.cwd(), "./test/fixture/app"));
  const publicFiles = fileBag.matches("./public/**");
  assertEquals(publicFiles.size, 4);
});
