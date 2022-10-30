import { join, sprintf } from "./deps.ts";
import { rootUrlToSafeLocalDirname } from "./fs.ts";
import {
  BareSpecifiersMap,
  resolveBareSpecifierRedirects,
} from "./graph/resolve.ts";
import { FileBag } from "./sources/fileBag.ts";
import { VirtualFile } from "./sources/virtualFile.ts";
import type { ImportMap, ModuleGraph } from "./types.ts";
import { ensureLeadingSlash, ensureTrailingSlash } from "./utils.ts";

type VendorModuleGraphOptions = {
  name: string;
  output: string;
  sources: FileBag;
  bareSpecifiers: BareSpecifiersMap;
};

export function vendorModuleGraph(
  graph: ModuleGraph,
  options: VendorModuleGraphOptions,
): [FileBag, ImportMap] {
  const {
    output,
    name,
    sources,
    bareSpecifiers,
  } = options;

  const vendorSources = new FileBag();
  const vendorDir = "vendor";

  const modules = graph.modules.values();

  for (const module of modules) {
    if (module.specifier.startsWith("file://") === false) {
      const resolved = graph.get(module.specifier);

      if (resolved) {
        const path = rootUrlToSafeLocalDirname(
          new URL(module.specifier),
          join(output, vendorDir, name),
        );

        const file = new VirtualFile(path, output, resolved.source);
        vendorSources.add(file);
      }
    }
  }

  const importMap: ImportMap = createImportMapFromModuleGraph(
    graph,
    { sources, bareSpecifiers, pathPrefix: `./${vendorDir}/${name}` },
  );

  return [vendorSources, importMap];
}

type CreateImportMapFromModuleGraphOptions = {
  sources: FileBag;
  bareSpecifiers: BareSpecifiersMap;
  pathPrefix: string;
};

function createImportMapFromModuleGraph(
  graph: ModuleGraph,
  options: CreateImportMapFromModuleGraphOptions,
) {
  const { sources, pathPrefix } = options;
  const imports = new Map<string, string>();
  const scopes = new Map<string, string[]>();

  const modules = graph.modules.values();
  const redirects = graph.toJSON().redirects;

  const bareSpecifiers = resolveBareSpecifierRedirects(
    options.bareSpecifiers,
    redirects,
  );

  function pushScopedImport(specifier: URL) {
    const scopeUrl = new URL("/", specifier);

    const scopedPath = ensureTrailingSlash(
      rootUrlToSafeLocalDirname(scopeUrl, pathPrefix),
    );

    if (!scopes.has(scopedPath)) {
      scopes.set(scopedPath, []);
    }

    const scope = scopes.get(scopedPath);
    scope?.push(specifier.pathname);

    if (!imports.has(String(scopeUrl))) {
      imports.set(String(scopeUrl), scopedPath);
    }
  }

  for (const module of modules) {
    const rootUrl = removeSearchParams(new URL(module.specifier));
    const specifier = String(rootUrl);

    // Resolve local source
    if (specifier.startsWith("file:")) {
      // Find the local source matching this specifier
      const source = sources.find((source) =>
        String(source.url()) === specifier
      );

      if (source) {
        const relativePath = source.relativePath().replaceAll("\\", "/");
        imports.set(relativePath, relativePath);
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
        const module = graph.get(resolvedSpecifier);
        if (module) {
          const path = rootUrlToSafeLocalDirname(
            new URL(module.specifier),
            pathPrefix,
          );
          // react -> ./vendor/path/react.js
          imports.set(bareSpecifier, path);
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

  return {
    imports: Object.fromEntries(imports),
    scopes: Object.fromEntries(collapseScopes(scopes)),
  };
}

function collapseScopes(scopes: Map<string, string[]>) {
  const collapsed: Map<string, Record<string, string>> = new Map();

  for (const [scope, imports] of scopes) {
    const paths = new Map(
      imports.map((specifier) => {
        const indexOfSlash = ensureLeadingSlash(specifier).indexOf("/", 1);
        const end = indexOfSlash >= 0 ? indexOfSlash : undefined;
        const path = ensureTrailingSlash(specifier.substring(1, end));

        return [
          ensureLeadingSlash(path),
          ensureTrailingSlash(scope) + path,
        ];
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
