import { join } from "./deps.ts";

export function getFixtureDir(path: string) {
  return join(Deno.cwd(), "test", "fixture", path).replaceAll("\\", "/");
}

export function getOutputDir(path: string) {
  return join(getFixtureDir(path), ".build").replaceAll("\\", "/");
}

export function getFixturePath(fixture: string, path: string) {
  const fixtureDir = getFixtureDir(fixture);
  return join(fixtureDir, path).replaceAll("\\", "/");
}

export function createRelativeUrl(
  url: string,
  base: URL,
): URL {
  return new URL(url, ensureTrailingSlash(base));
}

export function ensureRelativePath(path: string) {
  return path.startsWith(".") ? path : [".", path].join("/");
}

export function ensureTrailingSlash(string: string | URL) {
  string = typeof string === "string" ? string : String(string);
  return string.endsWith("/") ? string : `${string}/`;
}
