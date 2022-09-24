import { assertEquals, assertThrows, toFileUrl } from "./deps.ts";
import {
  BareSpecifiersMap,
  createResolver,
  resolveBareSpecifierRedirects,
} from "../lib/graph/resolve.ts";
import { FileBag } from "../lib/sources/fileBag.ts";
import { VirtualFile } from "../lib/sources/virtualFile.ts";
import { createLoader } from "../lib/graph/load.ts";
import { gatherSources } from "../lib/sources/gatherSources.ts";
import { ensureTrailingSlash, getFixtureDir } from "./helpers.ts";
import { createGraph } from "../lib/deps.ts";

const baseUrl = "file:///app/";

const importMap = {
  imports: {
    "react": "https://esm.sh/react@18.2.0?pin=v93",
    "react/": "https://esm.sh/react@18.2.0&pin=v93/",
    "react-dom": "https://esm.sh/react-dom@18.2.0?pin=v93",
    "react-dom/": "https://esm.sh/react-dom@18.2.0&pin=v93/",
    "@tanstack/react-query":
      "https://esm.sh/@tanstack/react-query?external=react&pin=v93",
    "ultra/": "https://deno.land/x/ultra/",
    "graphql-type-json": "https://cdn.skypack.dev/graphql-type-json@0.3.2?dts",
  },
};

const sources = new FileBag([
  new VirtualFile("./client.tsx", baseUrl, "entrypoint"),
  new VirtualFile("./src/app.1234567890.tsx", baseUrl, "app.tsx").setAlias(
    "./src/app.tsx",
  ),
  new VirtualFile("./src/components/Test.1234567890.tsx", baseUrl, "testing")
    .setAlias(
      "./src/components/Test.tsx",
    ),
]);

Deno.test("it can create a module graph", async () => {
  const bareSpecifiers: BareSpecifiersMap = new Map();

  const fixtureDir = getFixtureDir("graph");
  const fixtureUrl = toFileUrl(ensureTrailingSlash(fixtureDir));

  const sources = await gatherSources(fixtureDir);
  const load = createLoader({ sources, target: "browser" });
  const resolve = createResolver({
    importMap,
    sources,
    bareSpecifiers,
    baseURL: fixtureUrl,
  });

  const entrypoint = new URL("client.tsx", fixtureUrl);
  const graph = await createGraph(String(entrypoint), {
    load,
    resolve,
    defaultJsxImportSource: "react",
  });

  const { redirects } = graph.toJSON();

  const resolvedBareSpecifiers = resolveBareSpecifierRedirects(
    bareSpecifiers,
    redirects,
  );

  assertEquals(
    Object.fromEntries(resolvedBareSpecifiers),
    {
      "react/jsx-runtime":
        "https://esm.sh/stable/react@18.2.0/es2022/jsx-runtime.js",
      "react": "https://esm.sh/stable/react@18.2.0/es2022/react.js",
      "graphql-type-json":
        "https://cdn.skypack.dev/-/graphql-type-json@v0.3.2-DhOL463jxxvyflH53O4H/dist=es2019,mode=imports/optimized/graphql-type-json.js",
    },
  );
});

Deno.test("it can resolve and load specifiers", async () => {
  const bareSpecifiers: BareSpecifiersMap = new Map();

  const load = createLoader({ sources, target: "deno" });
  const resolve = createResolver({
    importMap,
    sources,
    bareSpecifiers,
    baseURL: new URL(baseUrl),
  });

  /**
   * Bare import specifiers
   */
  assertEquals(
    resolve("react", baseUrl),
    "https://esm.sh/react@18.2.0?pin=v93",
  );

  assertEquals(
    resolve("react-dom/client", baseUrl),
    "https://esm.sh/react-dom@18.2.0&pin=v93/client",
  );

  assertEquals(
    resolve("@tanstack/react-query", baseUrl),
    "https://esm.sh/@tanstack/react-query?external=react&pin=v93",
  );

  assertEquals(
    resolve("ultra/server.ts", baseUrl),
    "https://deno.land/x/ultra/server.ts",
  );

  /**
   * Relative local file path specifiers
   */
  assertEquals(
    resolve("./client.tsx", baseUrl),
    "file:///app/client.tsx",
  );

  /**
   * This should throw an error, since server.tsx is not specified
   * in "sources"
   */
  assertThrows(() => resolve("./server.tsx", baseUrl));

  assertEquals(
    resolve("./src/app.tsx", baseUrl),
    "file:///app/src/app.1234567890.tsx",
  );

  assertEquals(
    resolve("./src/components/Test.tsx", baseUrl),
    "file:///app/src/components/Test.1234567890.tsx",
  );

  assertEquals(Object.fromEntries(bareSpecifiers), {
    "react": "https://esm.sh/react@18.2.0?pin=v93",
    "react-dom/client": "https://esm.sh/react-dom@18.2.0&pin=v93/client",
    "@tanstack/react-query":
      "https://esm.sh/@tanstack/react-query?external=react&pin=v93",
    "ultra/server.ts": "https://deno.land/x/ultra/server.ts",
  });

  /**
   * Test loading modules
   */
  const react = await load(resolve("react", baseUrl));
  assertEquals(react?.kind, "module");
  assertEquals(
    react?.specifier,
    "https://esm.sh/stable/react@18.2.0/es2022/react.js",
  );

  const reactDom = await load(resolve("react-dom", baseUrl));
  assertEquals(reactDom?.kind, "module");
  assertEquals(
    reactDom?.specifier,
    "https://esm.sh/v93/react-dom@18.2.0/es2022/react-dom.js",
  );

  const reactDomServer = await load(resolve("react-dom/server", baseUrl));
  assertEquals(reactDomServer?.kind, "module");
  assertEquals(
    reactDomServer?.specifier,
    "https://esm.sh/v93/react-dom@18.2.0/es2022/server.js",
  );

  const jsxRuntime = await load(resolve("react/jsx-runtime", baseUrl));
  assertEquals(jsxRuntime?.kind, "module");
  assertEquals(
    jsxRuntime?.specifier,
    "https://esm.sh/stable/react@18.2.0/es2022/jsx-runtime.js",
  );

  const app = await load(resolve("./src/app.tsx", baseUrl));
  assertEquals(app?.kind, "module");
  assertEquals(app?.specifier, "file:///app/src/app.1234567890.tsx");
});

Deno.test("it can resolve and load for a specific target", async () => {
  const bareSpecifiers: BareSpecifiersMap = new Map();

  const load = createLoader({ sources, target: "deno" });
  const resolve = createResolver({
    importMap,
    sources,
    bareSpecifiers,
    baseURL: new URL(baseUrl),
  });

  /**
   * Test loading modules
   */
  const react = await load(resolve("react", baseUrl));
  assertEquals(react?.kind, "module");
  assertEquals(
    react?.specifier,
    "https://esm.sh/stable/react@18.2.0/deno/react.js",
  );
});
