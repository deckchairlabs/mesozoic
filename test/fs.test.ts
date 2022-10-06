import { dirname, fromFileUrl, join } from "../lib/deps.ts";
import { rootUrlToSafeLocalDirname } from "../lib/fs.ts";

Deno.test("it works", () => {
  const destination = join(dirname(fromFileUrl(import.meta.url)), "vendor");

  console.log(
    rootUrlToSafeLocalDirname(
      new URL("https://esm.sh/react@18.2.0/react.js"),
      destination,
    ),
  );
});
