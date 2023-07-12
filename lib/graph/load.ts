import { gte, parse } from "https://deno.land/std@0.193.0/semver/mod.ts";
import {
  cache,
  crayon,
  ImportSpecifier,
  initModuleLexer,
  parseModule,
  RELOAD_POLICY,
  sprintf,
  toFileUrl,
} from "../deps.ts";
import { type LoggerImpl } from "../logger.ts";
import { Patterns } from "../patterns.ts";
import { IFile } from "../sources/file.ts";
import { FileBag } from "../sources/fileBag.ts";
import { LoadResponse, LoadResponseModule, Policy, Target } from "../types.ts";
import { wrapFn } from "../utils.ts";
import { isLocalSpecifier, isRemoteSpecifier } from "./specifiers.ts";

await initModuleLexer;

export type Loader = (
  url: string,
  isDynamic?: boolean,
) => Promise<LoadResponse | undefined>;

type CreateLoaderOptions = {
  sources: FileBag;
  target: Target;
  dynamicImports: FileBag;
  dynamicImportIgnored?: Patterns;
  policy?: Policy;
};

const isEsmShDenoNext = gte(parse(Deno.version.deno), parse("1.33.2"));

export function createLoader(options: CreateLoaderOptions): Loader {
  const { sources, dynamicImportIgnored, dynamicImports } = options;
  const policy = Deno.args.includes("--reload") ? RELOAD_POLICY : options.policy;

  const target: Target = options.target === "deno" && isEsmShDenoNext ? "denonext" : options.target;

  return async function loader(specifier: string, isDynamic?: boolean) {
    try {
      if (isRemoteSpecifier(specifier)) {
        if (isDynamic && dynamicImportIgnored?.test(specifier)) {
          return Promise.resolve(undefined);
        }

        return loadRemoteSpecifier(specifier, target, policy);
      } else {
        const [response, source] = await loadLocalSpecifier(specifier, sources);

        if (isDynamic && source) {
          dynamicImports.add(source);
        }

        return response;
      }
    } catch {
      return Promise.resolve(undefined);
    }
  };
}

export function wrapLoaderWithLogging(
  loader: Loader,
  logger: LoggerImpl,
): Loader {
  return wrapFn(
    loader,
    (specifier) => logger.debug(sprintf("%s %s", crayon.red("Load"), specifier)),
  );
}

export function createLoadRequest(specifier: string, target: Target) {
  const url = prepareRequestUrl(new URL(specifier), target);
  const requestHeaders = new Headers();

  if (target === "browser") {
    requestHeaders.set("User-Agent", "mesozoic");
  }

  return new Request(String(url), {
    redirect: "follow",
    headers: requestHeaders,
  });
}

function isDirectModuleSpecifier(specifier: string) {
  return (
    specifier.endsWith(".js") ||
    specifier.endsWith(".jsx") ||
    specifier.endsWith(".json") ||
    specifier.endsWith(".mjs") ||
    specifier.endsWith(".cjs") ||
    specifier.endsWith(".ts") ||
    specifier.endsWith(".tsx")
  );
}

export async function loadRemoteSpecifier(
  specifier: string,
  target: Target,
  policy?: Policy,
): Promise<LoadResponse | undefined> {
  try {
    const request = createLoadRequest(specifier, target);
    const cached = await cache(request.url, policy);

    const response = await fetch(toFileUrl(cached.path));
    const responseUrl = cached.url;
    const responseHeaders = new Headers(cached.meta.headers);

    if (response.status !== 200) {
      // ensure the body is read as to not leak resources
      await response.arrayBuffer();
      return undefined;
    }

    const content = await response.text();

    if (!isDirectModuleSpecifier(specifier)) {
      const facadeRedirect = resolveFacadeModuleRedirect(
        specifier,
        content,
      );

      if (facadeRedirect) {
        return loadRemoteSpecifier(facadeRedirect.href, target, policy);
      }
    }

    return {
      kind: "module",
      specifier: String(new URL(responseUrl.pathname, responseUrl.origin)),
      headers: Object.fromEntries(responseHeaders),
      content,
    };
  } catch (error) {
    console.debug({ specifier, target });
    console.error(error);
    return undefined;
  }
}

export async function loadLocalSpecifier(
  specifier: string,
  sources: FileBag,
): Promise<[LoadResponse, IFile] | []> {
  const source = sources.find((source) => {
    if (isLocalSpecifier(specifier)) {
      return String(source.url()) === specifier;
    }
    return source.relativePath() === specifier;
  });

  if (source) {
    const content = await source.read();
    const response: LoadResponse = {
      kind: "module",
      specifier: isLocalSpecifier(specifier)
        ? String(source.url())
        : String(toFileUrl(source.path())),
      content,
    };

    return [response, source];
  }

  return [];
}

export function isModuleResponse(
  response: LoadResponse | undefined,
): response is LoadResponseModule {
  return response?.kind === "module";
}

export function resolveFacadeModuleRedirect(
  specifier: string,
  content: string,
): URL | undefined {
  const [imports, facade] = parseModule(content);

  if (facade) {
    const uniqueImports = resolveUniqueRemoteSpecifiers(
      imports,
      specifier,
    );

    const lastImport = uniqueImports.at(-1);

    if (lastImport) {
      return new URL(lastImport);
    }
  }
}

export function resolveUniqueRemoteSpecifiers(
  imports: readonly ImportSpecifier[],
  referrer: string,
) {
  // Resolve the named imports
  let namedImports = imports.map((specifier) => specifier.n).filter(
    nonNullable,
  );

  /**
   * Resolve relative imports like "export * from '/-/graphql-type-json/...'";
   */
  namedImports = namedImports.map((specifier) => {
    if (specifier.startsWith("/") && referrer.startsWith("http")) {
      return new URL(specifier, referrer).href;
    }
    return specifier;
  });

  // Resolve unique remote imports
  return Array.from(
    new Set(
      namedImports.filter((specifier) => isRemoteSpecifier(specifier)),
    ).values(),
  );
}

export function prepareRequestUrl(
  url: URL,
  target: Target = "browser",
) {
  switch (url.host) {
    case "esm.sh":
      /**
       * We don't want types from esm.sh
       */
      url.searchParams.append("no-check", "1");

      /**
       * Add the target
       */
      url.searchParams.append(
        "target",
        target === "browser" ? "es2022" : target,
      );

      /**
       * We don't want development sources
       */
      url.searchParams.delete("dev");
      url.pathname = url.pathname.replace("&dev", "");
      break;
  }

  return url;
}

export function nonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}
