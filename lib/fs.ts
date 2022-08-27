import { extname, join, sprintf } from "./deps.ts";

export function getUniquePath(
  path: string,
  uniqueSet: Set<string>,
): string {
  let count = 2;

  while (uniqueSet.has(path.toLowerCase())) {
    path = pathWithStemSuffix(path, sprintf("_%d", count));
    count += 1;
  }

  return path;
}

export function pathWithStemSuffix(path: string, suffix: string) {
  const extension = extname(path);

  if (extension) {
    return path.replace(extension, sprintf(`%s%s`, suffix, extension));
  }

  return sprintf("%s%s", path, suffix);
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
