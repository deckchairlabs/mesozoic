# 🌄 mesozoic

![GitHub Workflow Status](https://github.com/deckchairlabs/mesozoic/actions/workflows/ci.yml/badge.svg)
[![Deno module](https://shield.deno.dev/x/mesozoic)](https://deno.land/x/mesozoic)
![Deno compatibility](https://shield.deno.dev/deno/^1.20.0)

### A generic build system for Deno web apps.

## What does it do?

Mesozoic takes your source files from `root`, copies those source files to `output` (preserving your
project directory structure), transforms your JavaScript/TypeScript with [swc](https://swc.rs/),
transforms your stylesheets with [Lightning CSS](https://lightningcss.dev/) and writes those
resulting transformations to your `output` directory.

## API

You can build your own bespoke build system on top of Mesozoic, which
[Ultra.js](https://ultrajs.dev) is currently doing.

```ts
import { Builder, ContextBuilder } from "https://deno.land/x/mesozoic@v1.2.4/mod.ts";

const context = new ContextBuilder()
  /**
   * The absolute path to the "root" of your project.
   */
  .setRoot(import.meta.resolve("./"))
  /**
   * The absolute path to where you would like the build to output to.
   */
  .setOutput(import.meta.resolve("./.output"))
  /**
   * Ignore files from the build, relative to "root".
   * Any file that matches the provided patterns won't be copied to the build output directory.
   */
  .ignore(["./README.md"])
  /**
   * Files which should have their contents hashed and appended to the filename,
   * great for long term caching (https://web.dev/use-long-term-caching/)
   */
  .contentHash([
    "./src/**/*.+(ts|tsx|js|jsx|css)",
    "./public/**/*.+(css|ico|jpg|png|svg|gif|otf|ttf|woff)",
  ])
  /**
   * Files which should be compiled by SWC, usually TypeScript or files with JSX.
   */
  .compile([
    "./**/*.+(ts|tsx|js|jsx)",
    // We can negate a pattern by prefixing it with "!"
    "!./vendor/server/**/*",
  ])
  /**
   * Build and validate the context.
   */
  .build();

/**
 * Create a new builder with the context as defined above.
 */
const builder = new Builder(context, {
  /**
   * A custom name for your builder!
   */
  name: "mesozoic",
  logLevel: "INFO",
  compilerOptions: {
    minify: true,
    sourceMaps: false,
    jsxImportSource: "react",
  },
  cssOptions: {
    minify: true,
    sourceMaps: false,
    browserslist: ["chrome 100"],
  },
});

/**
 * Setup your entrypoints, relative to "root".
 * A module graph will be built for each entry point defined.
 * Remote dependencies will also be independently fetched and output for each entrypoint.
 *
 * The key of the entrypoints config is the name of the entrypoint and also the output
 * directory name within the vendor output directory.
 */
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

/**
 * Clean the output directory
 */
await builder.cleanOutput();

/**
 * Gather all source files from the root
 */
const sources = await builder.gatherSources();

/**
 * Execute the build
 */
const result = await builder.build(sources);
```
