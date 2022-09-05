import { assertEquals, assertThrows, join, toFileUrl } from "./deps.ts";
import {
  createResolver,
  resolveBareSpecifierRedirects,
} from "../lib/graph/resolve.ts";
import { FileBag } from "../lib/sources/fileBag.ts";
import { VirtualFile } from "../lib/sources/virtualFile.ts";
import { createLoader } from "../lib/graph/load.ts";
import { createGraph } from "../lib/graph/createGraph.ts";
import { gatherSources } from "../lib/sources/gatherSources.ts";
import {
  ensureRelativePath,
  ensureTrailingSlash,
  getFixtureDir,
} from "./helpers.ts";
import { SEP } from "../lib/deps.ts";

const baseUrl = ensureTrailingSlash(toFileUrl(join(SEP, "app")).href);

const importMap = {
  imports: {
    "react": "https://esm.sh/react",
    "react/": "https://esm.sh/react/",
    "react-dom": "https://esm.sh/react-dom",
    "react-dom/": "https://esm.sh/react-dom/",
    "@tanstack/react-query":
      "https://esm.sh/@tanstack/react-query?external=react",
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
  const bareSpecifiers = new Map<string, string>();

  const fixtureDir = getFixtureDir("graph");
  const fixtureUrl = toFileUrl(ensureTrailingSlash(fixtureDir));

  const sources = await gatherSources(fixtureDir);
  const load = createLoader(sources);
  const resolve = createResolver(
    importMap,
    sources,
    bareSpecifiers,
    fixtureUrl,
  );

  const entrypoint = join(String(fixtureUrl), ensureRelativePath("client.tsx"));
  const graph = await createGraph(String(entrypoint), load, resolve);

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
  const bareSpecifiers = new Map<string, string>();

  const load = createLoader(sources);
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
    "https://esm.sh/@tanstack/react-query?external=react",
  );

  assertEquals(
    resolve("ultra/server.ts", baseUrl),
    "https://deno.land/x/ultra/server.ts",
  );

  /**
   * Relative local file path specifiers
   */
  assertEquals(
    resolve([".", "client.tsx"].join(SEP), baseUrl),
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
    "react": "https://esm.sh/react",
    "react/client": "https://esm.sh/react/client",
    "@tanstack/react-query":
      "https://esm.sh/@tanstack/react-query?external=react",
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
  const bareSpecifiers = new Map<string, string>();

  const load = createLoader(sources, "deno");
  const resolve = createResolver(
    importMap,
    sources,
    bareSpecifiers,
    new URL(baseUrl),
  );

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
