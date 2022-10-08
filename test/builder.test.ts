import { assertEquals, assertSnapshot } from "./deps.ts";

import { BuildContext, BuildContextBuilder, Builder } from "../mod.ts";
import { getFixtureDir, getOutputDir } from "./helpers.ts";

const outputDir = getOutputDir("app");

async function createBuilder(context: BuildContext) {
  const builder = new Builder(context);

  await builder.cleanOutput();

  return builder;
}

Deno.test("it can copy, compile and vendor entrypoints producing valid import maps", async (t) => {
  const context = new BuildContextBuilder()
    .setRoot(getFixtureDir("app"))
    .setOutput(outputDir)
    .setImportMapPath("./importMap.json")
    .ignore([
      "./README.md",
      "./.private/**/*",
      "./.git/**/*",
    ])
    .contentHash([
      "./+(src|public)/**/*.+(ts|tsx|js|jsx|css|jpg)",
      "./client.+(ts|tsx|js|jsx)",
    ])
    .compile([
      "./src/**/*.+(ts|tsx|js|jsx)",
      "./vendor/browser/**/*.+(ts|tsx|js|jsx)",
      "./+(client|server).+(ts|tsx|js|jsx)",
    ])
    .build();

  const builder = await createBuilder(context);

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

  const sources = await builder.gatherSources();
  const result = await builder.build(sources);

  const vendored = result.outputSources.filter((source) =>
    source.relativePath().startsWith("./vendor")
  );

  assertEquals(result.outputSources.size > 0, true);
  assertEquals(vendored.size > 0, true);
  assertEquals(result.importMaps.size, 2);
  assertEquals(builder.toManifest(result.outputSources).length, 7);

  for (const [, importMap] of result.importMaps) {
    await assertSnapshot(t, importMap);
  }
});
