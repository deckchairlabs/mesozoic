import { assertEquals } from "./deps.ts";
import { createResolver } from "../lib/graph/resolve.ts";
import { FileBag } from "../lib/fileBag.ts";
import { VirtualFile } from "../lib/virtualFile.ts";

Deno.test("it can resolve specifiers", () => {
  const importMap = {
    imports: {
      "react": "https://esm.sh/react",
      "react/": "https://esm.sh/react/",
      "@tanstack/react-query": "https://esm.sh/@tanstack/react-query",
      "ultra/": "https://deno.land/x/ultra/",
    },
  };

  const baseUrl = "file:///app/";

  const sources = new FileBag([
    new VirtualFile("./src/app.1234567890.tsx", baseUrl, "app.tsx").setAlias(
      "./src/app.tsx",
    ),
    new VirtualFile("./src/components/Test.1234567890.tsx", baseUrl, "testing")
      .setAlias(
        "./src/components/Test.tsx",
      ),
  ]);

  const bareSpecifiers = new Map<string, string>();
  const resolve = createResolver(
    importMap,
    sources,
    bareSpecifiers,
    new URL(baseUrl),
  );

  /**
   * Bare import specifiers
   */
  assertEquals(
    resolve("react", baseUrl),
    "https://esm.sh/react",
  );

  assertEquals(
    resolve("react/client", baseUrl),
    "https://esm.sh/react/client",
  );

  assertEquals(
    resolve("@tanstack/react-query", baseUrl),
    "https://esm.sh/@tanstack/react-query",
  );

  assertEquals(
    resolve("ultra/server.ts", baseUrl),
    "https://deno.land/x/ultra/server.ts",
  );

  /**
   * Relative local file path specifiers
   */
  assertEquals(
    resolve("./src/client.tsx", baseUrl),
    "file:///app/src/client.tsx",
  );

  assertEquals(
    resolve("./src/app.tsx", baseUrl),
    "./src/app.1234567890.tsx",
  );

  assertEquals(
    resolve("./src/components/Test.tsx", baseUrl),
    "./src/components/Test.1234567890.tsx",
  );

  assertEquals(Object.fromEntries(bareSpecifiers), {
    "react": "https://esm.sh/react",
    "react/client": "https://esm.sh/react/client",
    "@tanstack/react-query": "https://esm.sh/@tanstack/react-query",
    "ultra/server.ts": "https://deno.land/x/ultra/server.ts",
  });
});
