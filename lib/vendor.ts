import { Builder } from "./builder.ts";
import { ensureDir, fromFileUrl, join, sprintf } from "./deps.ts";
import { IFile } from "./file.ts";
import { FileBag } from "./fileBag.ts";
import { ImportMap, ModuleGraph } from "./types.ts";
import { isRemoteSpecifier } from "./utils.ts";
import { rootUrlToSafeLocalDirname } from "./fs.ts";
import { VirtualFile } from "./virtualFile.ts";

export async function vendorRemoteModules(
  builder: Builder,
  graph: ModuleGraph,
  redirects: Record<string, string>,
  entrypoint: IFile,
  localSources: FileBag,
) {
  const entrypointConfig = builder.getEntrypoint(
    entrypoint.relativeAlias() ||
      entrypoint.relativePath(),
  );

  const vendorPath = join("vendor", entrypointConfig?.output || "");

  const outputDir = join(
    builder.context.output,
    vendorPath,
  );

  const vendored = new FileBag();
  await ensureDir(outputDir);

  const redirectMap = new Map(Object.entries(redirects));
  const imports = new Map<string, string>();

  const entrypointFilePath = entrypoint.url().href;
  builder.log.info(sprintf("Resolved entrypoint: %s", entrypointFilePath));

  /**
   * If the entrypoint has an alias, we add it to the importMaps imports
   */
  if (entrypoint.alias()) {
    imports.set(
      entrypoint.relativeAlias() || entrypoint.relativePath(),
      entrypoint.relativePath(),
    );
  }

  for (const [specifier, redirect] of redirectMap.entries()) {
    try {
      if (isRemoteSpecifier(redirect)) {
        const path = rootUrlToSafeLocalDirname(new URL(redirect));

        const outputPath = join(
          vendorPath,
          path,
        );

        const module = graph.get(redirect);

        if (module) {
          imports.set(specifier, `./${outputPath}`);
          vendored.add(
            new VirtualFile(
              join(outputDir, path),
              outputDir,
              module.source,
            ),
          );
        }
      } else {
        const localSource = localSources.find((source) =>
          source.path() === fromFileUrl(redirect)
        );
        if (localSource) {
          const from = localSource.relativeAlias() ||
            localSource.relativePath();
          const to = localSource.relativePath();

          imports.set(from, to);
        }
      }
    } catch (error) {
      console.error(error);
      console.log({ specifier, redirect });
    }
  }

  /**
   * Create the importMap
   */
  const importMap: ImportMap = {
    imports: Object.fromEntries(imports.entries()),
    scopes: {},
  };

  vendored.add(
    new VirtualFile(
      join(outputDir, "importMap.json"),
      outputDir,
      JSON.stringify(importMap, null, 2),
    ),
  );

  return {
    outputDir,
    vendored,
    importMap,
  };
}
