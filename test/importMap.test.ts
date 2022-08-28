import { groupBy } from "https://deno.land/std@0.153.0/collections/group_by.ts";
import { default as importMap } from "./fixture/importMap/importMap.json" assert { type: "json" };

Deno.test("it works", () => {
  const importSpecifiers = Object.keys(importMap.imports).filter((specifier) =>
    specifier.startsWith("http")
  ).map((specifier) => new URL(specifier));

  const groupedByOrigin = groupBy(
    importSpecifiers,
    (specifier) => specifier.origin,
  );

  const imports = new Map<string, string>();
  const scopes = new Map<string, Map<string, string>>();
  const vendorPath = "./vendor/browser/";

  for (const [origin, specifiers] of Object.entries(groupedByOrigin)) {
    if (specifiers) {
      const url = new URL(origin);
      const host = `${vendorPath}${url.host}/`;

      imports.set(`${origin}/`, host);
      const scoped = new Map<string, string>();

      for (const specifier of specifiers.values()) {
        scoped.set(
          specifier.pathname,
          [host, specifier.pathname.replace(/^\/+/, "")].join(""),
        );
      }

      scopes.set(host, scoped);
    }
  }

  console.log({ imports, scopes });
});
