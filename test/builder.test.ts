import { assertSnapshot } from "https://deno.land/std@0.153.0/testing/snapshot.ts";
import { Builder } from "../mod.ts";
import { getFixtureDir, getOutputDir } from "./helpers.ts";

const outputDir = getOutputDir();

async function createBuilder() {
  const builder = new Builder({
    root: getFixtureDir(),
    output: outputDir,
    importMap: "./importMap.json",
    logLevel: "INFO",
  });

  await builder.cleanOutput();

  return builder;
}

Deno.test("it can copy, compile and vendor entrypoints producing valid import maps", async (t) => {
  const builder = await createBuilder();

  builder.setEntrypoints({
    "./client.tsx": {
      vendorOutputDir: "browser",
      target: "browser",
    },
    "./server.tsx": {
      vendorOutputDir: "server",
      target: "deno",
    },
  });

  builder.setExcluded([
    "./README.md",
    "./.private/**/*",
    "./.git/**/*",
  ]);

  builder.setHashed([
    "./+(src|public)/**/*.+(ts|tsx|js|jsx|css)",
    "./client.+(ts|tsx|js|jsx)",
  ]);

  builder.setCompiled([
    "./**/*.+(ts|tsx|js|jsx)",
  ]);

  const sources = await builder.gatherSources();
  const buildSources = await builder.copySources(sources);
  const { entrypoints } = await builder.build(buildSources);

  for (const entrypoint of entrypoints.values()) {
    assertSnapshot(t, entrypoint.importMap);
  }
});
