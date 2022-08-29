# 🌄 mesozoic

A work in progress generic build system for Deno web/server apps.

```ts
import { Builder } from "https://deno.land/x/mesozoic@v1.0.0-alpha.28/mod.ts";

const builder = new Builder({
  root: "/absolute/path/to/source",
  output: "/absolute/path/to/output",
});

/**
 * Setup your entrypoints, relative to "root"
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
 * Exclude files from the build, relative to "root"
 */
builder.setExcluded([
  "./README.md",
]);

/**
 * Files with should have their contents hashed, great for long lived caching
 */
builder.setHashed([
  "./src/**/*.+(ts|tsx|js|jsx|css)",
  "./public/**/*.+(css|ico|jpg|png|svg|gif|otf|ttf|woff)",
]);

/**
 * Files which should be compiled, usually TypeScript or files with JSX
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
