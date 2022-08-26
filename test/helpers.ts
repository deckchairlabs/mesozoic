import { join } from "./deps.ts";

export function getFixtureDir() {
  return join(Deno.cwd(), "test", "fixture");
}

export function getOutputDir() {
  return join(getFixtureDir(), ".build");
}

export function getFixturePath(path: string) {
  const fixtureDir = getFixtureDir();
  return join(fixtureDir, path);
}
