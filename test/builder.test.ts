import { Builder } from "../lib/builder.ts";
import { getFixtureDir, getOutputDir } from "./helpers.ts";
import { assertSnapshot } from "./deps.ts";

const outputDir = getOutputDir();

async function createBuilder() {
  const builder = new Builder({
    root: getFixtureDir(),
    output: outputDir,
    entrypoints: ["./client.ts", "./server.ts"],
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
        "./deno.json",
        "./public/robots.txt",
      ],
    },
  });

  await builder.cleanOutput();

  return builder;
}

Deno.test("it works", async (t) => {
  const builder = await createBuilder();
  const sources = await builder.gatherSources();
  const buildSources = await builder.copySources(sources);

  await builder.vendorSources(
    sources.filter((source) => builder.isEntrypoint(source)),
  );

  await builder.build(buildSources);

  assertSnapshot(t, builder.toManifest(buildSources, "/_builder/static"));
});
