import { Builder } from "./builder.ts";
import { join, sprintf } from "./deps.ts";
import { Entrypoint } from "./entrypoint.ts";
import { rootUrlToSafeLocalDirname } from "./fs.ts";
import { FileBag } from "./sources/fileBag.ts";
import { VirtualFile } from "./sources/virtualFile.ts";
import type { ImportMap } from "./types.ts";

export async function vendorEntrypoint(
  builder: Builder,
  entrypoint: Entrypoint,
  sources: FileBag,
) {
  const outputName = entrypoint.config?.vendorOutputDir || "";
  const vendorPath = join("vendor", outputName);
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

          vendorSources.add(
            new VirtualFile(path, outputDir, resolved.source),
          );
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
          builder.context.output,
          sprintf("importMap%s.json", outputName ? `.${outputName}` : ""),
        ),
        builder.context.output,
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
  const scopes = new Map<string, string[]>();
  const bareSpecifiers = entrypoint.bareImportSpecifiers;
  const vendorUrlPrefix = `./${vendorPath}`;

  function pushScopedImport(specifier: URL) {
    const scopeUrl = new URL("/", specifier);

    const scopedPath = rootUrlToSafeLocalDirname(scopeUrl, vendorUrlPrefix) +
      "/";

    if (!scopes.has(scopedPath)) {
      scopes.set(scopedPath, []);
    }

    const scope = scopes.get(scopedPath);
    scope?.push(specifier.pathname);

    if (!imports.has(String(scopeUrl))) {
      imports.set(String(scopeUrl), scopedPath);
    }
  }

  if (entrypoint.moduleGraph) {
    const graph = entrypoint.moduleGraph.toJSON();
    const modules = entrypoint.moduleGraph.modules.values();

    // Prepare the redirects
    for (const [specifier, redirect] of Object.entries(graph.redirects)) {
      bareSpecifiers.set(specifier, redirect);
    }

    for (const module of modules) {
      const rootUrl = removeSearchParams(new URL(module.specifier));
      const specifier = String(rootUrl);

      // Resolve local source
      if (specifier.startsWith("file://")) {
        // Find the local source matching this specifier
        const source = sources.find((source) =>
          source.url().href === specifier
        );

        if (source) {
          imports.set(
            source.relativeAlias() || source.relativePath(),
            source.relativePath(),
          );
        } else {
          throw new Error(
            sprintf("failed to find local source %s", specifier),
          );
        }
      } else {
        pushScopedImport(rootUrl);
      }
    }

    for (const [bareSpecifier, resolvedSpecifier] of bareSpecifiers) {
      let specifier = resolvedSpecifier;

      try {
        specifier = new URL(resolvedSpecifier).href;
      } catch (_error) {
        specifier = resolvedSpecifier;
      }

      if (imports.has(bareSpecifier)) {
        imports.set(specifier, imports.get(bareSpecifier)!);
      } else {
        try {
          const module = entrypoint.moduleGraph.get(resolvedSpecifier);
          if (module) {
            const vendorPath = rootUrlToSafeLocalDirname(
              new URL(module.specifier),
              vendorUrlPrefix,
            );
            // react -> ./vendor/path/react.js
            imports.set(bareSpecifier, vendorPath);
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

  return {
    imports: Object.fromEntries(imports),
    scopes: Object.fromEntries(collapseRemoteSpecifiers(scopes)),
  };
}

function collapseRemoteSpecifiers(scopes: Map<string, string[]>) {
  const collapsed: Map<string, Record<string, string>> = new Map();

  for (const [scope, imports] of scopes) {
    const paths = new Map(
      imports.map((specifier) => {
        const indexOfSlash = specifier.indexOf("/", 1);
        const end = indexOfSlash >= 0 ? indexOfSlash : undefined;
        const path = specifier.substring(1, end);
        return [`/${path}/`, scope + path + "/"];
      }),
    );

    collapsed.set(scope, Object.fromEntries(paths));
  }

  return collapsed;
}

function removeSearchParams(url: URL) {
  for (const param of url.searchParams.keys()) {
    url.searchParams.delete(param);
  }
  return url;
}
