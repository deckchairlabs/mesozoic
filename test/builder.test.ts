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

Deno.test("it works", async (t) => {
  const builder = await createBuilder();

  builder.setEntrypoints({
    "./client.tsx": {
      output: "browser",
      target: "browser",
    },
    // "./server.tsx": {
    //   output: "server",
    //   target: "deno",
    // },
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
    if (entrypoint.moduleGraph) {
      const { modules, redirects } = entrypoint.moduleGraph.toJSON();
      console.log(redirects, modules);
    }
  }

  // assertSnapshot(t, builder.context);
  // assertSnapshot(
  //   t,
  //   builder.toManifest(buildSources, {
  //     exclude: [
  //       "./importMap.json",
  //       "./deno.json",
  //       "./public/robots.txt",
  //     ],
  //     prefix: "/_builder/static",
  //   }),
  // );
  // assertSnapshot(t, result);
});
