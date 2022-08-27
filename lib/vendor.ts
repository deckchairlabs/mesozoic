import { Builder } from "./builder.ts";
import {
  ensureDir,
  fromFileUrl,
  initModuleLexer,
  join,
  parseModule,
  sprintf,
} from "./deps.ts";
import { IFile } from "./file.ts";
import { FileBag } from "./fileBag.ts";
import { ImportMap, ModuleGraphJson, ModuleJson } from "./types.ts";
import { isRemoteSpecifier } from "./utils.ts";
import { rootUrlToSafeLocalDirname } from "./fs.ts";
import { isBareSpecifier } from "./graph.ts";

export function vendorRemoteModules(
  builder: Builder,
  graph: ModuleGraphJson,
  sources: FileBag,
  entrypoint: IFile,
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

  const redirectMap = new Map(
    Object.entries(graph.redirects),
  );

  const imports = new Map<string, string>();

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

  console.log(importMap);

  // for (const module of moduleMap.values()) {
  //   const dependencies = getModuleDependencyMap(moduleMap, aliases, module);
  // }
  // await ensureDir(outputDir);

  // const path = entrypoint.url();
  // const module = graph.modules.get(path.href);

  // if (module) {
  //   const [imports] = parseModule(module.source);
  //   const modules = getAllModules(graph, module);
  // } else {
  //   throw new Error(
  //     sprintf("No module found in module graph for %s", path.href),
  //   );
  // }

  // // for (const [specifier, module] of graph.modules.entries()) {
  // //   if (isRemoteSpecifier(specifier)) {
  // //     console.log(specifier);
  // //   }
  // // }
}

function getModuleDependencyMap(
  moduleMap: Map<string, ModuleJson>,
  aliases: Map<string, string>,
  dependent: ModuleJson,
): Map<string, ModuleJson> {
  const dependencies: [string, ModuleJson][] = [];

  if (dependent.dependencies) {
    for (const dependency of dependent.dependencies) {
      const specifier = dependency.specifier;
    }
  }

  return new Map(dependencies);
}
