import { SEP } from "../lib/deps.ts";
import { join } from "./deps.ts";

export function getFixtureDir(path: string) {
  return join(Deno.cwd(), "test", "fixture", path);
}

export function getOutputDir(path: string) {
  return join(getFixtureDir(path), ".build");
}

export function getFixturePath(fixture: string, path: string) {
  const fixtureDir = getFixtureDir(fixture);
  return join(fixtureDir, path);
}

export function createRelativeUrl(
  url: string,
  base: URL,
): URL {
  return new URL(url, ensureTrailingSlash(base));
}

export function crossPlatformPath(path: string) {
  switch (Deno.build.os) {
    case "windows":
      return path.replaceAll("/", "\\");
    default:
      return path;
  }
}

export function ensureRelativePath(path: string) {
  return path.startsWith(".") ? path : [".", path].join(SEP);
}

export function ensureTrailingSlash(string: string | URL) {
  string = typeof string === "string" ? string : String(string);
  return string.endsWith("/") ? string : `${string}/`;
}
