import { assertEquals } from "https://deno.land/std@0.153.0/testing/asserts.ts";
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
    const importSpecifiers = Object.keys(entrypoint.importMap.imports || {});

    console.log(importSpecifiers);

    // assertEquals(importSpecifiers.includes("./client.tsx"), true);
    // assertEquals(importSpecifiers.includes("./src/app.tsx"), true);

    // /**
    //  * Make sure we're getting bare specifiers
    //  */
    // assertEquals(importSpecifiers.includes("react"), true);
    // assertEquals(
    //   importSpecifiers.includes("react/jsx-runtime"),
    //   true,
    // );
    // assertEquals(
    //   importSpecifiers.includes("react-dom/client"),
    //   true,
    // );
    // assertEquals(
    //   importSpecifiers.includes("ultra/hooks/use-asset.js"),
    //   true,
    // );
    // assertEquals(
    //   importSpecifiers.includes("/stable/react@18.2.0/deno/react.js"),
    //   true,
    // );
    // assertEquals(
    //   importSpecifiers.includes("/v92/react-dom@18.2.0/deno/react-dom.js"),
    //   true,
    // );
    // assertEquals(
    //   importSpecifiers.includes("/v92/scheduler@0.23.0/deno/scheduler.js"),
    //   true,
    // );
  }
});
