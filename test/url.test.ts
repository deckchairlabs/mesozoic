import { createRelativeUrl } from "../lib/url.ts";
import { assertEquals } from "./deps.ts";

Deno.test("it can create relative urls", () => {
  assertEquals(
    createRelativeUrl("./client.tsx", new URL("file:///workspace")).href,
    "file:///workspace/client.tsx",
  );
});
