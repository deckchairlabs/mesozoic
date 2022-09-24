import { assertEquals } from "./deps.ts";
import {
  createImportMapResolver,
  createLocalResolver,
  createResolver,
  resolve,
} from "../lib/graph/resolve.ts";
import { FileBag } from "../lib/sources/fileBag.ts";
import { VirtualFile } from "../lib/sources/virtualFile.ts";

Deno.test("it works", () => {
  const importMap = {
    imports: {
      "react": "https://esm.sh/react@18.2.0",
    },
  };
  const bareSpecifiers = new Map<string, string>();

  const sources = new FileBag();
  sources.add(new VirtualFile("./client.tsx", "file:///", "testing"));

  const resolve = createResolver({
    importMap,
    bareSpecifiers,
    sources,
    baseURL: new URL("file:///"),
  });

  assertEquals(
    resolve("react", "file:///app.tsx"),
    "https://esm.sh/react@18.2.0",
  );

  assertEquals(
    resolve("https://esm.sh/react@18.2.0", "file:///app.tsx"),
    "https://esm.sh/react@18.2.0",
  );

  assertEquals(
    resolve("./client.tsx", "file:///app.tsx"),
    "file:///client.tsx",
  );
});

Deno.test("it can resolve a specifier with a referrer", () => {
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

Deno.test("it can resolve from an importMap", () => {
  const resolve = createImportMapResolver({
    imports: {
      "react": "https://esm.sh/react@18.2.0",
    },
  }, new URL("file:///app.tsx"));

  assertEquals(
    resolve("react", "file:///app.tsx"),
    "https://esm.sh/react@18.2.0",
  );
});

Deno.test("it can resolve from a FileBag", () => {
  const sources = new FileBag();
  sources.add(new VirtualFile("./client.tsx", "file:///app", "testing"));

  const resolve = createLocalResolver(sources);

  assertEquals(
    resolve("./client.tsx", "file:///app/app.tsx"),
    "file:///app/client.tsx",
  );

  assertEquals(
    resolve("file:///app/client.tsx", "file:///app/app.tsx"),
    "file:///app/client.tsx",
  );

  assertEquals(
    resolve("client.tsx", "file:///app/app.tsx"),
    "file:///app/client.tsx",
  );
});
