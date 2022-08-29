import { ImportSpecifier, initModuleLexer } from "../deps.ts";
import { parseModule } from "../deps.ts";
import { FileBag } from "../sources/fileBag.ts";
import { LoadResponse } from "../types.ts";
import { isLocalSpecifier, isRemoteSpecifier } from "./specifiers.ts";

export type Loader = (url: string) => Promise<LoadResponse | undefined>;

export function createLoader(
  sources: FileBag,
  target: "browser" | "deno" = "browser",
): Loader {
  return (specifier: string) => {
    try {
      if (isRemoteSpecifier(specifier)) {
        return loadRemote(specifier, target);
      } else {
        return loadLocal(specifier, sources);
      }
    } catch {
      return Promise.resolve(undefined);
    }
  };
}

const cache = new WeakMap<URL, string>();

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

    if (cache.has(url)) {
      const cached = cache.get(url)!;
      return {
        kind: "module",
        specifier: String(new URL(url.pathname, url.origin)),
        headers: Object.fromEntries(requestHeaders),
        content: cached,
      };
    }

    const response = await fetch(request);

    if (response.status !== 200) {
      // ensure the body is read as to not leak resources
      await response.arrayBuffer();
      console.log(url);
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
    await initModuleLexer;
    const [imports, exports, facade] = await parseModule(content);
    if (facade && (exports.length === 1 || imports.length === 1)) {
      const uniqueSpecifiers = resolveUniqueRemoteSpecifiers(imports);
      if (uniqueSpecifiers[0]) {
        const specifier = new URL(uniqueSpecifiers[0]);
        return loadRemote(specifier.href, target);
      }
    }

    cache.set(url, content);

    return {
      kind: "module",
      specifier: String(new URL(url.pathname, url.origin)),
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
  const source = await sources.find((source) => {
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
) {
  return Array.from(
    new Set(
      imports.map((element) => element.n).filter((specifier) =>
        specifier?.startsWith("http")
      ),
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
      break;
  }

  return url;
}
