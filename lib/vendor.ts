import { join, sprintf } from "./deps.ts";
import { rootUrlToSafeLocalDirname } from "./fs.ts";
import { BareSpecifiersMap } from "./graph/resolve.ts";
import { FileBag } from "./sources/fileBag.ts";
import { VirtualFile } from "./sources/virtualFile.ts";
import type { ImportMap, ModuleGraph } from "./types.ts";

type VendorModuleGraphOptions = {
  output: string;
  vendorOutput: string;
  graph: ModuleGraph;
  sources: FileBag;
  bareSpecifiers: BareSpecifiersMap;
};

export function vendorModuleGraph(options: VendorModuleGraphOptions) {
  const {
    graph: moduleGraph,
    output,
    vendorOutput,
    sources,
    bareSpecifiers,
  } = options;

  const vendorSources = new FileBag();

  const outputDir = join(
    output,
    vendorOutput,
  );

  if (moduleGraph) {
    const graph = moduleGraph;
    const modules = graph.modules.values();

    for (const module of modules) {
      if (module.specifier.startsWith("file://") === false) {
        const resolved = graph.get(module.specifier);
        if (resolved) {
          const path = rootUrlToSafeLocalDirname(
            new URL(module.specifier),
            vendorOutput,
          );

          vendorSources.add(
            new VirtualFile(path, outputDir, resolved.source),
          );
        }
      }
    }
  }

  const importMap: ImportMap = createImportMapFromModuleGraph(
    moduleGraph,
    sources,
    bareSpecifiers,
    vendorOutput,
  );

  return importMap;
}

function createImportMapFromModuleGraph(
  moduleGraph: ModuleGraph,
  sources: FileBag,
  bareSpecifiers: BareSpecifiersMap,
  vendorPath: string,
) {
  const imports = new Map<string, string>();
  const scopes = new Map<string, string[]>();
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

  if (moduleGraph) {
    const graph = moduleGraph.toJSON();
    const modules = moduleGraph.modules.values();

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
          const module = moduleGraph.get(resolvedSpecifier);
          if (module) {
            const vendorPath = rootUrlToSafeLocalDirname(
              new URL(module.specifier),
              vendorUrlPrefix,
            );
            // react -> ./vendor/path/react.js
            imports.set(bareSpecifier, vendorPath);
          } else {
            if (resolvedSpecifier.includes(".d.ts") === false) {
              // no-op
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
