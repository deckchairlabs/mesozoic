import { Builder } from "../lib/builder.ts";
import { getFixtureDir, getOutputDir } from "./helpers.ts";

const outputDir = getOutputDir();

async function createBuilder() {
  const builder = new Builder({
    root: getFixtureDir(),
    output: outputDir,
    entrypoints: ["./client.ts", "./server.ts"],
    ignore: [
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
  });

  await builder.cleanOutput();

  return builder;
}

Deno.test("it works", async () => {
  const builder = await createBuilder();
  await builder.gatherSources();
  const sources = await builder.copySources();
  const compiled = sources.filter((source) => builder.isCompilable(source));
  console.log(compiled);
});
