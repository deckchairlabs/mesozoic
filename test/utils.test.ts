import { assertEquals } from "./deps.ts";
import { rootUrlToSafeLocalDirname } from "../lib/utils.ts";

Deno.test("rootUrlToSafeLocalDirname", () => {
  const url = new URL(
    "https://esm.sh/v92/react-dom@18.2.0/es2020/server.js?no-dts=&target=es2020",
  );
  assertEquals(
    rootUrlToSafeLocalDirname(url),
    "esm.sh/v92/react-dom@18.2.0/es2020/server.js",
  );
});
