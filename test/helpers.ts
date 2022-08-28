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
