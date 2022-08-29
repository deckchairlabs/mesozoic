import { Builder } from "./builder.ts";
import { join, sprintf } from "./deps.ts";
import { FileBag } from "./sources/fileBag.ts";
import { rootUrlToSafeLocalDirname } from "./fs.ts";
import { VirtualFile } from "./sources/virtualFile.ts";
import { Entrypoint } from "./entrypoint.ts";
import type { ImportMap } from "./types.ts";

export async function vendorEntrypoint(
  builder: Builder,
  entrypoint: Entrypoint,
  sources: FileBag,
) {
  const vendorPath = join("vendor", entrypoint.config?.vendorOutputDir || "");
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
            vendorPath,
          );
          vendorSources.add(new VirtualFile(path, outputDir, resolved.source));
        }
      }
    }
  }

  const importMap: ImportMap = importMapFromEntrypoint(
    builder,
    entrypoint,
    sources,
    vendorPath,
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
    builder.log.success(
      sprintf("Vendored %d dependencies", vendorSources.size - 1),
    );
  }

  return entrypoint;
}

function importMapFromEntrypoint(
  builder: Builder,
  entrypoint: Entrypoint,
  sources: FileBag,
  vendorPath: string,
) {
  const imports = new Map<string, string>();
  const bareSpecifiers = entrypoint.bareImportSpecifiers;
  const vendorUrlPrefix = `./${vendorPath}`;

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
          throw new Error(
            sprintf("failed to find local source %s", moduleSpecifier),
          );
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
        specifier = new URL(resolvedSpecifier).href;
      } catch (_error) {
        specifier = resolvedSpecifier;
      }

      // If there was a redirect, use that
      if (redirects.has(bareSpecifier)) {
        imports.set(specifier, redirects.get(bareSpecifier)!);
      } // Otherwise check if there is already an import of this resolved specifier
      else if (imports.has(bareSpecifier)) {
        imports.set(specifier, imports.get(bareSpecifier)!);
      } else {
        try {
          const module = entrypoint.moduleGraph.get(resolvedSpecifier);
          if (module) {
            imports.set(
              bareSpecifier,
              rootUrlToSafeLocalDirname(
                new URL(module.specifier),
                vendorUrlPrefix,
              ),
            );
          } else {
            if (resolvedSpecifier.includes(".d.ts") === false) {
              builder.log.warning(
                `Failed to resolve bare specifier ${resolvedSpecifier}`,
              );
            }
          }
        } catch (error) {
          throw new Error(
            sprintf(
              "Failed to resolve from module graph %s",
              resolvedSpecifier,
            ),
            { cause: error },
          );
        }
      }
    }

    entrypoint.moduleGraph.free();
  }

  const importMap = generateScopedImportMap(imports, vendorPath);

  return importMap;
}

import { groupBy } from "https://deno.land/std@0.153.0/collections/group_by.ts";

function generateScopedImportMap(
  imports: Map<string, string>,
  vendorPath: string,
): ImportMap {
  vendorPath = `./${vendorPath}/`;

  const importSpecifiers = Array.from(imports.keys()).filter((specifier) =>
    specifier.startsWith("http")
  ).map((specifier) => new URL(specifier));

  const groupedByOrigin = groupBy(
    importSpecifiers,
    (specifier) => specifier.origin,
  );

  const scopes = new Map<string, Record<string, string>>();

  for (const [origin, specifiers] of Object.entries(groupedByOrigin)) {
    if (specifiers) {
      const url = new URL(origin);
      const host = `${vendorPath}${url.host}/`;

      imports.set(`${origin}/`, host);
      const scoped = new Map<string, string>();

      for (const specifier of specifiers.values()) {
        scoped.set(
          specifier.pathname,
          [host, specifier.pathname.replace(/^\/+/, "")].join(""),
        );

        imports.delete(specifier.href);
      }

      scopes.set(host, Object.fromEntries(scoped));
    }
  }

  return {
    imports: Object.fromEntries(imports),
    scopes: Object.fromEntries(scopes),
  };
}

function removeSearchParams(url: URL) {
  for (const param of url.searchParams.keys()) {
    url.searchParams.delete(param);
  }
  return url;
}
