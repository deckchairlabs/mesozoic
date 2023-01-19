import { assertEquals } from "./deps.ts";
import { compile } from "../lib/compiler.ts";

Deno.test("it works", async () => {
  const source = `
    'client';
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

  const result = await compile(
    source,
    {
      filename: "test.tsx",
      globals: {
        "__DEV__": "false",
        "__ULTRA_DEV__": "false",
      },
    },
  );

  assertEquals(result.includes("React"), false);
  assertEquals(result.includes("__DEV__"), false);
  assertEquals(result.includes("console.log('removed')"), false);
  assertEquals(result.includes('console.log("Not Deno")'), true);
  assertEquals(result.includes('import("./module.browser.js")'), true);
  // assertEquals(
  //   result.includes("compiler"),
  //   false,
  // );
  assertEquals(result.includes('console.log("not removed")'), true);
});
