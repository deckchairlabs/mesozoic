import { parse, resolve } from "https://esm.sh/@import-maps/resolve@1.0.1";

const importMap = {
  imports: {
    "./client.tsx": "./client.97c35c59.js",
    "./src/app.tsx": "./src/app.d28e4b24.js",
    "./src/components/Test.tsx": "./src/components/Test.8f9fddfe.js",
    "https://deno.land/": "./vendor/browser/deno.land/",
    "https://esm.sh/": "./vendor/browser/esm.sh/",
    react: "./vendor/browser/esm.sh/stable/react@18.2.0/es2022/react.js",
    "react-dom/client":
      "./vendor/browser/esm.sh/v93/react-dom@18.2.0/es2022/client.js",
    "react/jsx-runtime":
      "./vendor/browser/esm.sh/stable/react@18.2.0/es2022/jsx-runtime.js",
    "ultra/hooks/use-asset.js":
      "./vendor/browser/deno.land/x/ultra@v2.0.0-beta.2/hooks/use-asset.js",
  },
  scopes: {
    "./vendor/browser/deno.land/": {
      "/x/": "./vendor/browser/deno.land/x/",
    },
    "./vendor/browser/esm.sh/": {
      "/stable/": "./vendor/browser/esm.sh/stable/",
      "/v93/": "./vendor/browser/esm.sh/v93/",
    },
  },
};

const baseUrl = new URL(import.meta.url);
const parsedImportMap = parse(importMap, baseUrl);
console.log(
  resolve(
    "/stable/react@18.2.0/deno/react.js",
    parsedImportMap,
    new URL("https://esm.sh/v93/react-dom"),
  ),
);
