import { SourceFile } from "../lib/sources/sourceFile.ts";
import { assertEquals, assertRejects, assertSnapshot, join } from "./deps.ts";
import {
  ensureRelativePath,
  getFixtureDir,
  getFixturePath,
} from "./helpers.ts";

const outputDir = await Deno.makeTempDir();

function createSourceFile(path: string) {
  return new SourceFile(
    getFixturePath("app", path),
    getFixtureDir("app"),
  );
}

Deno.test("constructor", async () => {
  const path = join("src", "app.tsx");
  const sourceFile = createSourceFile(path);

  assertEquals(sourceFile.isLocked(), true);
  assertEquals(sourceFile.root(), getFixtureDir("app"));
  assertEquals(
    sourceFile.path(),
    getFixturePath("app", sourceFile.relativePath()),
  );
  assertEquals(sourceFile.relativePath(), ensureRelativePath(path));
  assertEquals(await sourceFile.contentHash(), "886415b0");
});

Deno.test("copyTo", async () => {
  const sourceFile = createSourceFile(join("src", "app.tsx"));

  const copied = await sourceFile.copyTo(outputDir);
  assertEquals(copied.root(), outputDir);
  assertEquals(copied.path(), join(outputDir, copied.relativePath()));
  assertEquals(copied.isLocked(), false);
  assertEquals(await copied.contentHash(), await sourceFile.contentHash());
  /**
   * We should be able to remove this file since it was copied
   */
  assertEquals(await copied.remove(), true);
});

Deno.test("copyToHashed", async () => {
  const sourceFile = createSourceFile(join("src", "app.tsx"));

  const copied = await sourceFile.copyToHashed(outputDir);
  assertEquals(copied.root(), outputDir);
  assertEquals(copied.path(), join(outputDir, copied.relativePath()));
});

Deno.test("remove a locked file", () => {
  const sourceFile = createSourceFile(join("src", "app.tsx"));
  assertRejects(() => sourceFile.remove());
});

Deno.test("read a file", async (t) => {
  const sourceFile = createSourceFile(join("src", "app.tsx"));
  assertSnapshot(t, await sourceFile.read());
});

Deno.test("read a non existent file", () => {
  const sourceFile = createSourceFile(join("src", "app2.tsx"));
  assertRejects(() => sourceFile.read());
});
