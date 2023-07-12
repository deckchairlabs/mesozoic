import { RELOAD_POLICY } from "../lib/deps.ts";
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
import { assertEquals } from "./deps.ts";

Deno.test("it can load a remote specifier", async () => {
  const response = await loadRemoteSpecifier(
    "https://esm.sh/react@18.2.0",
    "deno",
    RELOAD_POLICY,
  );

  assertEquals(response?.kind, "module");
  assertEquals(
    response?.specifier,
    "https://esm.sh/stable/react@18.2.0/deno/react.mjs",
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
  const clientSource = new VirtualFile(
    "./client.tsx",
    "file:///app",
    "testing",
  );

  sources.add(clientSource);

  const [response, source] = await loadLocalSpecifier(
    "./client.tsx",
    sources,
  );

  assertEquals(response?.kind, "module");
  assertEquals(source, clientSource);
  assertEquals(
    response?.specifier,
    "file:///app/client.tsx",
  );

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

Deno.test("it can resolve facade module redirects", () => {
  assertEquals(
    String(resolveFacadeModuleRedirect(
      "https://esm.sh/react@18.2.0",
      `
      /* esm.sh - react@18.2.0 */
      export * from "https://esm.sh/stable/react@18.2.0/es2022/react.js";
      export { default } from "https://esm.sh/stable/react@18.2.0/es2022/react.js";
      `,
    )),
    "https://esm.sh/stable/react@18.2.0/es2022/react.js",
  );

  assertEquals(
    String(resolveFacadeModuleRedirect(
      "https://esm.sh/react-dom@18.2.0/",
      `
      /* esm.sh - react-dom@18.2.0 */
      import "https://esm.sh/stable/react@18.2.0/es2022/react.mjs";
      import "https://esm.sh/v128/scheduler@0.23.0/es2022/scheduler.mjs";
      export * from "https://esm.sh/v128/react-dom@18.2.0/es2022/react-dom.mjs";
      export { default } from "https://esm.sh/v128/react-dom@18.2.0/es2022/react-dom.mjs";
      `,
    )),
    "https://esm.sh/v128/react-dom@18.2.0/es2022/react-dom.mjs",
  );

  assertEquals(
    String(resolveFacadeModuleRedirect(
      "https://esm.sh/react-dom@18.2.0/client",
      `
      /* esm.sh - react-dom@18.2.0/client */
      import "https://esm.sh/v128/react-dom@18.2.0/es2022/react-dom.mjs";
      export * from "https://esm.sh/v128/react-dom@18.2.0/es2022/client.js";
      export { default } from "https://esm.sh/v128/react-dom@18.2.0/es2022/client.js";
      `,
    )),
    "https://esm.sh/v128/react-dom@18.2.0/es2022/client.js",
  );

  assertEquals(
    String(resolveFacadeModuleRedirect(
      "https://esm.sh/react@18.2.0/jsx-runtime",
      `
      /* esm.sh - react@18.2.0/jsx-runtime */
      import "https://esm.sh/stable/react@18.2.0/es2022/react.mjs";
      export * from "https://esm.sh/stable/react@18.2.0/es2022/jsx-runtime.js";
      export { default } from "https://esm.sh/stable/react@18.2.0/es2022/jsx-runtime.js";
      `,
    )),
    "https://esm.sh/stable/react@18.2.0/es2022/jsx-runtime.js",
  );

  assertEquals(
    String(resolveFacadeModuleRedirect(
      "https://esm.sh/twind@0.16.17",
      `
      /* esm.sh - twind@0.16.17 */
      import "https://esm.sh/v128/style-vendorizer@2.2.3/es2022/style-vendorizer.mjs";
      export * from "https://esm.sh/v128/twind@0.16.17/es2022/twind.mjs";
      `,
    )),
    "https://esm.sh/v128/twind@0.16.17/es2022/twind.mjs",
  );
});
