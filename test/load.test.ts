import { assertEquals } from "./deps.ts";
import {
  createLoadRequest,
  isModuleResponse,
  loadLocalSpecifier,
  loadRemoteSpecifier,
  prepareRequestUrl,
  resolveFacadeModuleRedirect,
} from "../lib/graph/load.ts";
import { FileBag } from "../lib/sources/fileBag.ts";
import { VirtualFile } from "../lib/sources/virtualFile.ts";

Deno.test("it can load a remote specifier", async () => {
  const response = await loadRemoteSpecifier(
    "https://esm.sh/react@18.2.0",
    "deno",
  );

  assertEquals(response?.kind, "module");
  assertEquals(
    response?.specifier,
    "https://esm.sh/stable/react@18.2.0/deno/react.js",
  );

  if (isModuleResponse(response)) {
    assertEquals(
      response.content.length > 0,
      true,
    );
  }
});

Deno.test("it can load a local specifier", async () => {
  const sources = new FileBag();
  sources.add(new VirtualFile("./client.tsx", "file:///app", "testing"));

  const response = await loadLocalSpecifier("./client.tsx", sources);
  assertEquals(response?.kind, "module");
  assertEquals(response?.specifier, "file:///app/client.tsx");

  if (isModuleResponse(response)) {
    assertEquals(response.content, "testing");
  }
});

Deno.test("it can prepare a request url", () => {
  /**
   * esm.sh specific
   */
  assertEquals(
    prepareRequestUrl(new URL("https://esm.sh/react@18.2.0?dev"), "deno"),
    new URL("https://esm.sh/react@18.2.0?no-check=1&target=deno"),
  );
  assertEquals(
    prepareRequestUrl(new URL("https://esm.sh/react@18.2.0?dev"), "browser"),
    new URL("https://esm.sh/react@18.2.0?no-check=1&target=es2022"),
  );

  assertEquals(
    prepareRequestUrl(
      new URL("https://deno.land/x/mesozoic/mod.ts"),
      "deno",
    ),
    new URL("https://deno.land/x/mesozoic/mod.ts"),
  );

  assertEquals(
    prepareRequestUrl(
      new URL("https://deno.land/x/mesozoic/mod.ts"),
      "browser",
    ),
    new URL("https://deno.land/x/mesozoic/mod.ts"),
  );
});

Deno.test("it creates a load request for a specifier and target", () => {
  const deno = createLoadRequest("https://esm.sh/react@18.2.0", "deno");
  assertEquals(deno.method, "GET");
  assertEquals(deno.redirect, "follow");
  assertEquals(
    deno.url,
    "https://esm.sh/react@18.2.0?no-check=1&target=deno",
  );

  const browser = createLoadRequest("https://esm.sh/react@18.2.0", "browser");
  assertEquals(browser.method, "GET");
  assertEquals(browser.redirect, "follow");
  assertEquals(
    browser.url,
    "https://esm.sh/react@18.2.0?no-check=1&target=es2022",
  );
  assertEquals(
    browser.headers.get("user-agent"),
    "mesozoic",
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
