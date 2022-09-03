# 🌄 mesozoic

A generic build system for Deno web/server apps.

```ts
import { Builder } from "https://deno.land/x/mesozoic@v1.0.0-alpha.36/mod.ts";

const builder = new Builder({
  root: "/absolute/path/to/source",
  output: "/absolute/path/to/output",
});

/**
 * Setup your entrypoints, relative to "root".
 * A module graph will be built for each entry point defined.
 * Remote dependencies will also be independently fetched and output,
 * into each entry points "vendorOutputDir" at ./vendor
 */
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

/**
 * Ignore files from the build, relative to "root".
 * Any file that matches the provided patterns won't be copied to the build output directory.
 */
builder.setIgnored([
  "./README.md",
]);

/**
 * Files which should have their contents hashed and added to the filename,
 * great for long term caching (https://web.dev/use-long-term-caching/)
 */
builder.setHashed([
  "./src/**/*.+(ts|tsx|js|jsx|css)",
  "./public/**/*.+(css|ico|jpg|png|svg|gif|otf|ttf|woff)",
]);

/**
 * Files which should be compiled, usually TypeScript or files with JSX.
 */
builder.setCompiled([
  "./**/*.+(ts|tsx|js|jsx)",
]);

/**
 * Clean the output directory
 */
await builder.cleanOutput();

/**
 * Gather all source files from the root
 */
const sources = await builder.gatherSources();

/**
 * Copy the files to the output directory
 */
const buildSources = await builder.copySources(sources);

/**
 * Execute the build
 */
const result = await builder.build(buildSources);
```
