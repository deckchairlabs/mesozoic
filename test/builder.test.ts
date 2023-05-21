import { log } from "../lib/deps.ts";
import { BuildContext, Builder, ContextBuilder } from "../mod.ts";
import { assertEquals, assertSnapshot } from "./deps.ts";
import { getFixtureDir, getOutputDir } from "./helpers.ts";

const outputDir = getOutputDir("app");

async function createBuilder(context: BuildContext) {
  const logLevel = Deno.env.get("MESOZOIC_LOG");
  const builder = new Builder(context, {
    logLevel: logLevel as log.LevelName,
  });

  await builder.cleanOutput();

  return builder;
}

Deno.test(
  "it can copy, compile and vendor entrypoints producing valid import maps",
  async (t) => {
    const context = new ContextBuilder()
      .setRoot(getFixtureDir("app"))
      .setOutput(outputDir)
      .setImportMapPath("./importMap.json")
      .ignore([
        "./README.md",
        "./.private/**/*",
        "./.git/**/*",
      ])
      .contentHash([
        "./**/*.+(ts|tsx|js|jsx|css|jpg)",
        "!./vendor/server/**/*",
        "!./server.+(ts|tsx|js|jsx)",
      ])
      .compile([
        "./**/*.+(ts|tsx|js|jsx)",
        "!./vendor/server/**/*",
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

    assertEquals(
      builder.toManifest(result.outputSources, {
        prefix: "/",
        ignore: ["./**/*", "!./public/**/*"],
      }).length,
      3,
    );

    for (const [, importMap] of result.importMaps) {
      await assertSnapshot(t, importMap);
    }
  },
);

Deno.test("it can copy and compile entrypoints producing valid import maps", async (t) => {
  const context = new ContextBuilder()
    .setRoot(getFixtureDir("app"))
    .setOutput(outputDir)
    .setImportMapPath("./importMap.json")
    .setVendorDependencies(false)
    .ignore([
      "./README.md",
      "./.private/**/*",
      "./.git/**/*",
    ])
    .contentHash([
      "./**/*.+(ts|tsx|js|jsx|css|jpg)",
      "!./vendor/server/**/*",
      "!./server.+(ts|tsx|js|jsx)",
    ])
    .compile([
      "./**/*.+(ts|tsx|js|jsx)",
      "!./vendor/server/**/*",
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
  assertEquals(vendored.size === 0, true);
  assertEquals(result.importMaps.size, 2);

  assertEquals(
    builder.toManifest(result.outputSources, {
      prefix: "/",
      ignore: ["./**/*", "!./public/**/*"],
    }).length,
    3,
  );

  for (const [, importMap] of result.importMaps) {
    await assertSnapshot(t, importMap);
  }
});
