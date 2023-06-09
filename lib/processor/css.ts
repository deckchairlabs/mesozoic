import init, {
  browserslistToTargets,
  transform,
} from "https://esm.sh/v122/lightningcss-wasm@1.21.0/index.js";
import { cache, join, toFileUrl } from "../deps.ts";
import { SourceProcessor } from "../types.ts";

export type CssProcessorOptions = {
  /**
   * @default true
   */
  minify?: boolean;
  /**
   * @default false
   */
  sourceMaps?: boolean;
  /**
   * @default ["chrome 100"]
   */
  browserslist?: string[];
};

export async function createCssProcessor(
  options: CssProcessorOptions = {},
): Promise<SourceProcessor> {
  const file = await cache(
    "https://esm.sh/v122/lightningcss-wasm@1.21.0/lightningcss_node_bg.wasm",
  );

  await init(toFileUrl(file.path));

  const {
    browserslist = ["chrome 100"],
    minify = true,
    sourceMaps = false,
  } = options;

  const decoder = new TextDecoder();

  return async function cssProcessor(sources) {
    const cssSources = sources.filter((source) => source.extension() === ".css");

    for (const source of cssSources.values()) {
      const code = await source.readBytes();

      const result = transform({
        filename: String(source.url()),
        code,
        minify,
        sourceMap: sourceMaps,
        cssModules: false,
        errorRecovery: true,
        targets: browserslistToTargets(browserslist),
        drafts: {
          customMedia: true,
          nesting: true,
        },
        analyzeDependencies: { preserveImports: true },
      });

      let transformedCode = decoder.decode(result.code);

      if (result.dependencies) {
        /**
         * Lookup dependency sources and replace placeholders
         * with the resolved path
         */
        for (const dependency of result.dependencies) {
          const isRemoteDependency = dependency.url.startsWith("http://") ||
            dependency.url.startsWith("https://");
          const placeholder = dependency.placeholder;

          if (!isRemoteDependency) {
            const relativeRoot = source.dirname().replace(source.root(), ".");
            const lookupPath = `./${join(relativeRoot, dependency.url)}`;
            const dependencySource = await sources.find((file) =>
              file.originalPath().relativePath() === lookupPath
            );

            if (dependencySource) {
              const path = dependencySource.relativePath();
              transformedCode = transformedCode.replaceAll(
                placeholder,
                path.replace(relativeRoot, "."),
              );
            } else {
              // If no source is found for the dependency, we assume it's a
              // remote URL and replace the placeholder with the original URL
              transformedCode = transformedCode.replaceAll(
                placeholder,
                dependency.url,
              );
            }
          } else {
            transformedCode = transformedCode.replaceAll(
              placeholder,
              dependency.url,
            );
          }
        }
      }

      await source.write(transformedCode, true);
    }

    return cssSources;
  };
}
