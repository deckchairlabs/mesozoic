# 🌄 mesozoic

A work in progress generic build system for Deno web/server apps.

```ts
import { Builder } from "https://deno.land/x/mesozoic@v1.0.0-alpha.13/mod.ts";

const builder = new Builder({
  root: "/path/to/source",
  output: "/path/to/output",
  entrypoints: [
    "./client.tsx",
    "./server.tsx",
  ],
});

/**
 * Gather all source files from the root
 */
const sources = await builder.gatherSources();

/**
 * Copy the files to the output directory
 */
const buildSources = await builder.copySources(sources);

await builder.vendorSources(
  sources.filter((source) => builder.isEntrypoint(source)),
);

const result = await builder.build(buildSources);
```
