import { Builder } from "../mod.ts";
import { getFixtureDir, getOutputDir } from "./helpers.ts";
import { assertSnapshot } from "./deps.ts";
import { ImportMap } from "../lib/types.ts";

const outputDir = getOutputDir();

async function createBuilder() {
  const builder = new Builder({
    root: getFixtureDir(),
    output: outputDir,
    entrypoints: {
      "./client.ts": {
        output: "browser",
        target: "browser",
      },
      "./server.ts": {
        output: "server",
        target: "deno",
      },
    },
    exclude: [
      "./README.md",
      "./.private/**/*",
      "./.git/**/*",
    ],
    hashable: [
      "./+(src|public)/**/*.+(ts|tsx|js|jsx|css)",
      "./client.+(ts|tsx|js|jsx)",
    ],
    compilable: [
      "./**/*.+(ts|tsx|js|jsx)",
    ],
    manifest: {
      exclude: [
        "./importMap.json",
        "./deno.json",
        "./public/robots.txt",
      ],
    },
  }, {
    logLevel: "INFO",
  });

  await builder.cleanOutput();

  return builder;
}

Deno.test("it works", async (t) => {
  const builder = await createBuilder();
  const sources = await builder.gatherSources();
  const buildSources = await builder.copySources(sources);

  const importMapSource = buildSources.find((source) =>
    source.relativePath() === "./importMap.json"
  );

  const importMap = importMapSource
    ? await importMapSource.readAsJson<ImportMap>()
    : undefined;

  await builder.build(buildSources, importMap);

  assertSnapshot(t, builder.toManifest(buildSources, "/_builder/static"));
});
