export function createRelativeUrl(
  url: string,
  base: URL,
): URL {
  return new URL(url, ensureTrailingSlash(base));
}

export function ensureTrailingSlash(string: string | URL) {
  string = typeof string === "string" ? string : String(string);
  return string.endsWith("/") ? string : `${string}/`;
}
