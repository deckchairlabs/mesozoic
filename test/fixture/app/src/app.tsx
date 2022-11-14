import { lazy } from "react";
import useAsset from "ultra/hooks/use-asset.js";
import Hello from "./components/Test.tsx";
import type { Foo } from "./types.ts";
import { create, type Sheet, ThemeConfiguration, type TW } from "twind";

const foo: Foo = "bar";
const tw = create({ preflight: false });

const LazyTest = lazy(() => import("./components/Test.tsx"));

export default function App() {
  console.log("Hello world!");
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>basic</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="shortcut icon" href={useAsset("/favicon.ico")} />
        <link rel="preload" as="style" href={useAsset("/style.css")} />
        <link rel="stylesheet" href={useAsset("/style.css")} />
      </head>
      <body>
        <main>
          <h1>
            <span></span>__<span></span>
          </h1>
          <Hello />
          <p>
            Welcome to <strong>Ultra</strong>. This is a barebones starter for your web app.
          </p>
          <p>
            Take{" "}
            <a
              href="https://ultrajs.dev/docs"
              target="_blank"
            >
              this
            </a>, you may need it where you are going. It will show you how to customise your
            routing, data fetching, and styling with popular libraries.
          </p>
        </main>
      </body>
    </html>
  );
}
