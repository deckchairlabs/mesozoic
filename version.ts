export const VERSION = "1.0.0-alpha.47";
export const VERSION_REGEX = /\/\/deno\.land\/x\/mesozoic@v[\w\.\-]+\//;

/** `prepublish` will be invoked before publish, return `false` to prevent the publish. */
export async function prepublish(version: string) {
  const newDenoLandVersion = `//deno.land/x/mesozoic@v${version}/`;

  const readme = await Deno.readTextFile("./README.md");

  console.log("Patching README.md");
  await Deno.writeTextFile(
    "./README.md",
    readme.replace(
      VERSION_REGEX,
      newDenoLandVersion,
    ),
  );
}

/** `postpublish` will be invoked after published. */
export function postpublish(version: string) {
  console.log("Upgraded to", version);
}
