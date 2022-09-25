import { assertSnapshot } from "https://deno.land/std@0.153.0/testing/snapshot.ts";
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

Deno.test("it can copy, compile and vendor entrypoints producing valid import maps", async (t) => {
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
    "https://deno.land/x/ultra@v2.0.0-beta.1/lib/middleware/compiler.ts",
  ]);

  builder.setCompiled([
    "./**/*.+(ts|tsx|js|jsx)",
  ]);

  const sources = await builder.gatherSources();
  const { entrypoints } = await builder.build(sources);

  for (const entrypoint of entrypoints) {
    // assertSnapshot(t, builder.getImportMap(entrypoint.name))
    console.log(builder.getImportMap(entrypoint.name));
  }
});
