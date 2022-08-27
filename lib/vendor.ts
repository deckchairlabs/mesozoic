import { Builder } from "./builder.ts";
import { ensureDir, fromFileUrl, join, sprintf } from "./deps.ts";
import { IFile } from "./file.ts";
import { FileBag } from "./fileBag.ts";
import { ImportMap, ModuleGraphJson } from "./types.ts";
import { isRemoteSpecifier } from "./utils.ts";
import { rootUrlToSafeLocalDirname } from "./fs.ts";

export async function vendorRemoteModules(
  builder: Builder,
  graph: ModuleGraphJson,
  entrypoint: IFile,
  sources: FileBag,
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

  await ensureDir(outputDir);

  const redirectMap = new Map(
    Object.entries(graph.redirects),
  );

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
    if (isRemoteSpecifier(redirect)) {
      const outputPath = join(
        vendorPath,
        rootUrlToSafeLocalDirname(new URL(redirect)),
      );

      imports.set(specifier, `./${outputPath}`);
    } else {
      const localSource = sources.find((source) =>
        source.path() === fromFileUrl(redirect)
      );
      if (localSource) {
        const from = localSource.relativeAlias() || localSource.relativePath();
        const to = localSource.relativePath();

        imports.set(from, to);
      }
    }
  }

  /**
   * Create the importMap
   */
  const importMap: ImportMap = {
    imports: Object.fromEntries(imports.entries()),
    scopes: {},
  };

  await Deno.writeTextFile(
    join(outputDir, "importMap.json"),
    JSON.stringify(importMap, null, 2),
  );
}
