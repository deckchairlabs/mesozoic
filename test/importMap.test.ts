import { Builder } from "../lib/builder.ts";
import { assertEquals } from "./deps.ts";
import { getFixtureDir, getOutputDir } from "./helpers.ts";

Deno.test("it works", async () => {
  const builder = new Builder({
    root: getFixtureDir(),
    output: getOutputDir(),
    importMap: "./importMap.json",
  });

  await builder.cleanOutput();

  const jsxRuntime = builder.resolveImportSpecifier("react/jsx-runtime");

  assertEquals(jsxRuntime.matched, true);
  assertEquals(
    jsxRuntime.resolvedImport.href,
    "https://esm.sh/react@18.2.0/jsx-runtime",
  );

  const reactDomServer = builder.resolveImportSpecifier(
    "react-dom/server",
  );

  assertEquals(reactDomServer.matched, true);
  assertEquals(
    reactDomServer.resolvedImport.href,
    "https://esm.sh/react-dom@18.2.0/server",
  );

  const nonExistant = builder.resolveImportSpecifier("something");
  assertEquals(nonExistant.matched, false);
  assertEquals(nonExistant.resolvedImport, null);
});
