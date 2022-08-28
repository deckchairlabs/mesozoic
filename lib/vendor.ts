import { Builder } from "./builder.ts";
import { join, sprintf } from "./deps.ts";
import { FileBag } from "./fileBag.ts";
import { rootUrlToSafeLocalDirname } from "./fs.ts";
import { VirtualFile } from "./virtualFile.ts";
import { Entrypoint } from "./entrypointFile.ts";
import { ImportMap } from "./importMap.ts";
// import { groupBy } from "https://deno.land/std@0.153.0/collections/group_by.ts";

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

  // importMap = generateImportMapScopes(importMap, vendorPath);

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

  const importMap: ImportMap = {
    imports: Object.fromEntries(imports.entries()),
  };

  return importMap;
}

// function generateImportMapScopes(importMap: ImportMap, vendorPath: string) {
//   if (importMap.imports) {
//     const entries = Object.entries(importMap.imports);
//     const imports: Record<string, string> = {};
//     const scopes: Record<string, Record<string, string>> = {};

//     const groupedByOrigin = groupBy(entries, ([specifier]) => {
//       const url = new URL(specifier, import.meta.url);
//       return `${url.origin}/`;
//     });

//     for (const [scope, specifiers] of Object.entries(groupedByOrigin)) {
//       // Handle remote origins
//       if (scope.startsWith("https://") || scope.startsWith("http://")) {
//         const url = new URL(scope);
//         imports[scope] = `./${join(vendorPath, url.host)}/`;
//       } else if (specifiers) {
//         for (const [specifier, resolved] of specifiers) {
//           imports[specifier] = resolved;
//         }
//       }
//     }

//     importMap.imports = imports;
//     importMap.scopes = scopes;
//   }
//   return importMap;
// }

function removeSearchParams(url: URL) {
  for (const param of url.searchParams.keys()) {
    url.searchParams.delete(param);
  }
  return url;
}
