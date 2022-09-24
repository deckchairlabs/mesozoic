import { assertEquals } from "./deps.ts";
import {
  createLoadRequest,
  resolveFacadeModuleRedirect,
} from "../lib/graph/load.ts";

Deno.test("it creates a load request for a specifier and target", () => {
  const request = createLoadRequest("https://esm.sh/react@18.2.0", "deno");
  assertEquals(request.method, "GET");
  assertEquals(request.redirect, "follow");
  assertEquals(
    request.url,
    "https://esm.sh/react@18.2.0?no-check=1&target=deno",
  );
});

Deno.test("it can resolve facade module redirects", async () => {
  const facadeRedirect = await resolveFacadeModuleRedirect(
    "https://esm.sh/react@18.2.0",
    `
    /* esm.sh - react@18.2.0 */
    export * from "https://esm.sh/stable/react@18.2.0/es2022/react.js";
    export { default } from "https://esm.sh/stable/react@18.2.0/es2022/react.js";`,
  );

  assertEquals(
    facadeRedirect?.href,
    "https://esm.sh/stable/react@18.2.0/es2022/react.js",
  );
});
