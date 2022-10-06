import init, {
  browserslistToTargets,
  transform,
} from "https://esm.sh/lightningcss-wasm@1.16.0/index.js";
import { cache, join, SEP, toFileUrl } from "../deps.ts";
import { SourceProcessor } from "../types.ts";

const file = await cache(
  "https://esm.sh/lightningcss-wasm@1.16.0/lightningcss_node_bg.wasm",
);

await init(toFileUrl(file.path));

export const cssProcessor: SourceProcessor = async (sources) => {
  const cssSources = sources.filter((source) => source.extension() === ".css");
  const decoder = new TextDecoder();

  for (const source of cssSources.values()) {
    const sourceBytes = await source.readBytes();

    const result = transform({
      filename: String(source.url()),
      code: sourceBytes,
      minify: true,
      cssModules: false,
      // TODO(deckchairlabs): make browserlist targets configurable
      targets: browserslistToTargets(["chrome 100"]),
      errorRecovery: true,
      sourceMap: true,
      drafts: {
        customMedia: true,
        nesting: true,
      },
      analyzeDependencies: true,
    });

    let transformedCode = decoder.decode(result.code);

    if (result.dependencies) {
      /**
       * Lookup dependency sources and replace placeholders
       * with the resolved path
       */
      for (const dependency of result.dependencies) {
        if (dependency.type === "url") {
          const relativeRoot = source.dirname().replace(source.root(), ".");
          const lookupPath = `.${SEP}${join(relativeRoot, dependency.url)}`;
          const dependencySource = await sources.find((file) =>
            file.relativePath(file.originalPath()) === lookupPath
          );

          if (dependencySource) {
            const path = dependencySource.relativePath();
            transformedCode = transformedCode.replaceAll(
              dependency.placeholder,
              path.replace(relativeRoot, "."),
            );
          }
        }
      }
    }

    await source.write(transformedCode, true);
  }

  return cssSources;
};
