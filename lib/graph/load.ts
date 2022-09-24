import { crayon, ImportSpecifier, initModuleLexer, sprintf } from "../deps.ts";
import { parseModule } from "../deps.ts";
import { Logger } from "../logger.ts";
import { FileBag } from "../sources/fileBag.ts";
import { LoadResponse, Target } from "../types.ts";
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
  dynamicImportIgnored: RegExp[];
};

export function createLoader(options: CreateLoaderOptions): Loader {
  const { sources, target, dynamicImportIgnored } = options;

  return function loader(specifier: string, isDynamic?: boolean) {
    try {
      if (isRemoteSpecifier(specifier)) {
        if (
          isDynamic && dynamicImportIgnored.some((skip) => skip.test(specifier))
        ) {
          return Promise.resolve(undefined);
        }
        return loadRemote(specifier, target);
      } else {
        return loadLocal(specifier, sources);
      }
    } catch {
      return Promise.resolve(undefined);
    }
  };
}

export function wrapLoaderWithLogging(
  loader: Loader,
  logger: Logger,
): Loader {
  return wrapFn(
    loader,
    (specifier) =>
      logger.debug(sprintf("%s %s", crayon.red("Load"), specifier)),
  );
}

const loadRemote = async (
  specifier: string,
  target: "browser" | "deno",
): Promise<LoadResponse | undefined> => {
  try {
    const url = prepareUrl(new URL(specifier), target);
    const requestHeaders = new Headers();

    if (target === "browser") {
      requestHeaders.set("User-Agent", "mesozoic");
    }

    const request = new Request(String(url), {
      redirect: "follow",
      headers: requestHeaders,
    });

    const response = await fetch(request);
    const responseUrl = new URL(response.url);

    if (response.status !== 200) {
      // ensure the body is read as to not leak resources
      await response.arrayBuffer();
      return undefined;
    }

    const content = await response.text();
    const headers: Record<string, string> = {};

    for (const [key, value] of response.headers) {
      headers[key.toLowerCase()] = value;
    }

    /**
     * If we detect a "facade" and there is only 1 import OR 1 export
     */
    const [imports, exports, facade] = await parseModule(content);

    if (facade && (exports.length === 1 || imports.length === 1)) {
      const uniqueSpecifiers = resolveUniqueRemoteSpecifiers(
        imports,
        specifier,
      );
      if (uniqueSpecifiers[0]) {
        const specifier = new URL(uniqueSpecifiers[0]);
        return loadRemote(specifier.href, target);
      }
    }

    return {
      kind: "module",
      specifier: String(new URL(responseUrl.pathname, responseUrl.origin)),
      headers,
      content,
    };
  } catch (error) {
    console.error(error);
    return undefined;
  }
};

export async function loadLocal(
  specifier: string,
  sources: FileBag,
): Promise<LoadResponse | undefined> {
  const source = sources.find((source) => {
    if (isLocalSpecifier(specifier)) {
      return String(source.url()) === specifier;
    }
    return source.relativePath() === specifier;
  });

  if (source) {
    const content = await source.read();
    return {
      kind: "module",
      specifier: isLocalSpecifier(specifier)
        ? String(source.url())
        : source.path(),
      content,
    };
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
      namedImports.filter((specifier) => specifier?.startsWith("http")),
    ).values(),
  );
}

export function prepareUrl(url: URL, target: "browser" | "deno" = "browser") {
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
        target === "browser" ? "es2022" : "deno",
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
