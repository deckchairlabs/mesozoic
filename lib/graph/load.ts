import type { ImportSpecifier } from "../deps.ts";
import { parseModule } from "../deps.ts";
import { LoadResponse } from "../types.ts";

type Loader = (url: URL) => Promise<LoadResponse | undefined>;

export function createLoader() {
  return async (specifier: string) => {
    const url = prepareUrl(new URL(specifier));
    const response = await load(url);

    try {
      switch (url.protocol) {
        case "file:": {
        }
        case "http:":
        case "https:": {
          if (response) {
          }
        }
      }
    } catch {
      return undefined;
    }
  };
}

const load: Loader = async (url: URL) => {
  try {
    switch (url.protocol) {
      case "file:": {
        const content = await Deno.readTextFile(url);
        return {
          kind: "module",
          specifier: String(url),
          content,
        };
      }

      case "http:":
      case "https:": {
        const response = await fetch(String(url), { redirect: "follow" });

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

        return {
          kind: "module",
          specifier: response.url,
          headers,
          content,
        };
      }
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
};

export async function resolveFacadeModule(content: string, load: Loader) {
  const [imports, exports, facade] = await parseModule(content);

  /**
   * If we detect a "facade" and there is only 1 import OR 1 export
   */
  if (facade && (exports.length === 1 || imports.length === 1)) {
    /**
     * We only do facade detection on remote modules
     */
    const uniqueSpecifiers = resolveUniqueRemoteSpecifiers(imports);

    if (uniqueSpecifiers[0]) {
      const specifier = new URL(uniqueSpecifiers[0]);
      return load(specifier);
    }
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

export function prepareUrl(url: URL, target?: string) {
  switch (url.host) {
    case "esm.sh":
      /**
       * We don't want types from esm.sh
       */
      url.searchParams.append("no-dts", "");

      /**
       * Add the target if provided
       */
      if (target) {
        url.searchParams.append("target", target);
      }
      /**
       * We don't want development sources
       */
      url.searchParams.delete("dev");
      break;
  }

  return url;
}
