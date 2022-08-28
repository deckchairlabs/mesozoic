import { Builder } from "./builder.ts";
import { join, sprintf } from "./deps.ts";
import { FileBag } from "./fileBag.ts";
import { rootUrlToSafeLocalDirname } from "./fs.ts";
import { VirtualFile } from "./virtualFile.ts";
import { Entrypoint } from "./entrypointFile.ts";
import { ImportMap } from "./importMap.ts";

export async function vendorEntrypoint(
  builder: Builder,
  entrypoint: Entrypoint,
  sources: FileBag,
) {
  const vendorPath = join("vendor", entrypoint.config?.vendorOutputDir || "");
  const vendorUrlPrefix = `./${vendorPath}`;
  const vendorSources = new FileBag();

  const outputDir = join(
    builder.context.output,
    vendorPath,
  );

  if (entrypoint.moduleGraph) {
    const graph = entrypoint.moduleGraph;
    const modules = graph.modules.values();

    for (const module of modules) {
      // Don't vendor local files
      if (module.specifier.startsWith("file://") === false) {
        const resolved = graph.get(module.specifier);
        if (resolved) {
          const path = rootUrlToSafeLocalDirname(
            new URL(module.specifier),
            vendorUrlPrefix,
          );
          vendorSources.add(new VirtualFile(path, outputDir, resolved.source));
        }
      }
    }
  }

  const importMap: ImportMap = importMapFromEntrypoint(
    entrypoint,
    sources,
    vendorUrlPrefix,
  );

  entrypoint.setImportMap(importMap);

  if (vendorSources.size > 0) {
    vendorSources.add(
      new VirtualFile(
        join(
          vendorPath,
          "importMap.json",
        ),
        outputDir,
        JSON.stringify(importMap, null, 2),
      ),
    );

    await builder.copySources(vendorSources);
  }

  return entrypoint;
}

function importMapFromEntrypoint(
  entrypoint: Entrypoint,
  sources: FileBag,
  vendorUrlPrefix: string,
) {
  const imports = new Map<string, string>();
  const bareSpecifiers = entrypoint.bareImportSpecifiers;

  if (entrypoint.moduleGraph) {
    const graph = entrypoint.moduleGraph.toJSON();
    const redirects = new Map<string, string>();
    const modules = entrypoint.moduleGraph.modules.values();

    // Prepare the redirects
    for (const [specifier, redirect] of Object.entries(graph.redirects)) {
      redirects.set(
        specifier,
        rootUrlToSafeLocalDirname(new URL(redirect), vendorUrlPrefix),
      );
    }

    for (const module of modules) {
      const moduleSpecifier =
        removeSearchParams(new URL(module.specifier)).href;

      // Resolve local source
      if (moduleSpecifier.startsWith("file://")) {
        // Find the local source matching this specifier
        const source = sources.find((source) =>
          source.url().href === moduleSpecifier
        );

        if (source) {
          imports.set(
            source.relativeAlias() || source.relativePath(),
            source.relativePath(),
          );
        } else {
          throw new Error("failed to find local source");
        }
      } else {
        imports.set(
          moduleSpecifier,
          rootUrlToSafeLocalDirname(new URL(moduleSpecifier), vendorUrlPrefix),
        );
      }
    }

    for (const [bareSpecifier, resolvedSpecifier] of bareSpecifiers) {
      let specifier = resolvedSpecifier;

      try {
        specifier = removeSearchParams(new URL(resolvedSpecifier)).href;
      } catch (_error) {
        // whatever
      }

      // If there was a redirect, use that
      if (redirects.has(bareSpecifier)) {
        imports.set(specifier, redirects.get(bareSpecifier)!);
      } // Otherwise check if there is already an import of this resolved specifier
      else if (imports.has(bareSpecifier)) {
        imports.set(specifier, imports.get(bareSpecifier)!);
      } else if (entrypoint.moduleGraph.get(resolvedSpecifier)) {
        const module = entrypoint.moduleGraph.get(resolvedSpecifier)!;
        imports.set(
          bareSpecifier,
          rootUrlToSafeLocalDirname(new URL(module.specifier), vendorUrlPrefix),
        );
      } else {
        if (resolvedSpecifier.includes(".d.ts")) {
          // Ignore type imports, stupid
        } else {
          console.error(
            `Failed to resolve bare specifier ${resolvedSpecifier}`,
          );
        }
      }
    }

    entrypoint.moduleGraph.free();
  }

  const importMap: ImportMap = {
    imports: Object.fromEntries(imports.entries()),
  };

  return importMap;
}

function removeSearchParams(url: URL) {
  for (const param of url.searchParams.keys()) {
    url.searchParams.delete(param);
  }
  return url;
}
