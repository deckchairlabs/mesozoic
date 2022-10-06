import { assertEquals } from "https://deno.land/std@0.153.0/testing/asserts.ts";
import { Builder } from "../mod.ts";
import { getFixtureDir, getOutputDir } from "./helpers.ts";

const outputDir = getOutputDir("app");

async function createBuilder() {
  const builder = new Builder({
    root: getFixtureDir("app"),
    output: outputDir,
    importMapPath: "./importMap.json",
  });

  await builder.cleanOutput();

  return builder;
}

Deno.test("it can copy, compile and vendor entrypoints producing valid import maps", async () => {
  const builder = await createBuilder();

  builder.setEntrypoints({
    "browser": {
      path: "./client.tsx",
      target: "browser",
    },
    "server": {
      path: "./server.tsx",
      target: "deno",
    },
  });

  builder.setIgnored([
    "./README.md",
    "./.private/**/*",
    "./.git/**/*",
  ]);

  builder.setHashed([
    "./+(src|public)/**/*.+(ts|tsx|js|jsx|css|jpg)",
    "./client.+(ts|tsx|js|jsx)",
  ]);

  builder.setDynamicImportIgnored([
    "https://deno.land/x/ultra@v2.0.0-beta.7/lib/middleware/compiler.ts",
  ]);

  builder.setCompiled([
    "./src/**/*.+(ts|tsx|js|jsx)",
    "./vendor/browser/**/*.+(ts|tsx|js|jsx)",
    "./+(client|server).+(ts|tsx|js|jsx)",
  ]);

  const sources = await builder.gatherSources();
  const result = await builder.build(sources);

  const vendored = result.outputSources.filter((source) =>
    source.relativePath().startsWith("./vendor")
  );

  assertEquals(result.outputSources.size > 0, true);
  assertEquals(vendored.size > 0, true);
  assertEquals(result.importMaps.size, 2);
});
