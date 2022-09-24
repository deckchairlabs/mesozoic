import { assertEquals } from "./deps.ts";
import { resolve } from "../lib/graph/resolve.ts";

Deno.test("it works", () => {
  assertEquals(resolve("react", "file:///app.tsx"), "react");
  assertEquals(
    resolve("/testing.js", "https://esm.sh/react@18.2.0/react.js"),
    "https://esm.sh/testing.js",
  );
  assertEquals(
    resolve("./app.tsx", "file:///workspace/client.tsx"),
    "file:///workspace/app.tsx",
  );
  assertEquals(
    resolve("../app.tsx", "file:///workspace/client.tsx"),
    "file:///app.tsx",
  );
});
