import { join } from "./deps.ts";

export function isRemoteSpecifier(specifier: string) {
  return specifier.startsWith("http");
}

export function rootUrlToSafeLocalDirname(url: URL): string {
  function sanitizeSegment(text: string): string {
    const chars = text.split("");
    return chars.map((char) => isBannedSegmentChar(char) ? "_" : char).join("");
  }

  const result: string[] = [];

  if (url.hostname) {
    result.push(sanitizeSegment(url.hostname));
  }

  if (url.port) {
    result.push("_");
    result.push(url.port);
  }

  if (url.pathname) {
    result.push(
      ...url.pathname.split("/").filter(Boolean).map((segment) =>
        sanitizeSegment(segment)
      ),
    );
  }

  return join(...result);
}

function isBannedSegmentChar(char: string) {
  return ["/", "\\"].includes(char) || isBannedPathChar(char);
}

function isBannedPathChar(char: string) {
  return ["<", ">", ":", '"', "|", "?", "*"].includes(char);
}
