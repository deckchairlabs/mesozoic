import init, {
  browserslistToTargets,
  transform,
} from "https://esm.sh/@parcel/css-wasm@1.13.1/index.js";
import { cache, join, toFileUrl } from "../deps.ts";
import { SourceProcessor } from "../types.ts";

const file = await cache(
  "https://esm.sh/@parcel/css-wasm@1.13.1/parcel_css_node_bg.wasm",
);

// @ts-ignore whatever
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
      targets: browserslistToTargets(["chrome 100"]),
      errorRecovery: true,
      sourceMap: true,
      drafts: {
        customMedia: true,
        nesting: true,
      },
      analyzeDependencies: true,
    });

    let transformed = decoder.decode(result.code);

    if (result.dependencies) {
      /**
       * Lookup dependency sources and replace placeholders
       * with the resolved path
       */
      for (const dependency of result.dependencies) {
        if (dependency.type === "url") {
          const relativeRoot = source.dirname().replace(source.root(), ".");
          const lookupPath = `./${join(relativeRoot, dependency.url)}`;
          const dependencySource = await sources.get(lookupPath);

          if (dependencySource) {
            const path = dependencySource.relativePath() ||
              dependencySource.relativeAlias();

            if (path) {
              transformed = transformed.replaceAll(
                dependency.placeholder,
                path.replace(relativeRoot, "."),
              );
            }
          }
        }
      }
    }

    await source.write(transformed);
  }

  return sources;
};
