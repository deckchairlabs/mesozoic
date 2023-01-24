import { assertEquals } from "./deps.ts";
import { compile } from "../lib/compiler.ts";

Deno.test("it works", async () => {
  const source = `
    import React from 'react';

    function Component() {
      return <div>Hello</div>;
    }

    let exports;

    const string: string = 'hello';

    if (typeof Deno === "undefined") {
      exports = await import('./module.browser.js');
    } else {
      exports = await import('./module.deno.js');
    }

    if (__DEV__) {
      console.log('removed')
      console.log(React)
    } else {
      console.log('not removed')
    }

    const loggingLevel = __ULTRA_DEV__ ? "DEBUG" : "ERROR";

    if (__ULTRA_DEV__) {
      console.log("Ultra dev")
    }
    
    if (typeof Deno !== "undefined") {
      console.log("Deno")
    }
    
    if (typeof Deno === "undefined") {
      console.log("Not Deno")
      console.log(Component)
    }

    console.log(loggingLevel)

    if (typeof Deno !== "undefined") {
      const { default: compiler } = await import('./compiler.ts');
    }

    export default exports;
  `;

  const devResult = await compile("test.tsx", source, {
    minify: false,
    development: true,
  });

  const prodResult = await compile("test.tsx", source, {
    minify: true,
    development: false,
  });

  assertEquals(devResult.includes('"react/jsx-dev-runtime"'), true);
  assertEquals(prodResult.includes('"react/jsx-runtime"'), true);
});
