import { assertEquals, assertRejects } from "./deps.ts";
import { compile } from "../lib/compiler.ts";

async function compileTest(
  source: string,
): Promise<[dev: string, prod: string]> {
  const dev = await compile("test.tsx", source, {
    minify: false,
    development: true,
  });

  const prod = await compile("test.tsx", source, {
    minify: true,
    development: false,
  });

  return [dev, prod];
}

Deno.test("it can compile JSX", async () => {
  const source = `
    export default function App() {
      return <div>Hello</div>;
    }
  `;

  const [dev, prod] = await compileTest(source);

  assertEquals(dev.includes('"react/jsx-dev-runtime"'), true);
  assertEquals(prod.includes('"react/jsx-runtime"'), true);
});

Deno.test("it can compile TSX", async () => {
  const source = `
    import { PropsWithChildren } from 'react';

    export default function App({ children }: PropsWithChildren) {
      return <div>{children}</div>;
    }

    const HomePage = () => <App><div>Hello</div></App>
  `;

  const [dev, prod] = await compileTest(source);

  assertEquals(dev.includes('"react/jsx-dev-runtime"'), true);
  assertEquals(prod.includes('"react/jsx-runtime"'), true);
});

Deno.test("it throws errors", async () => {
  const source = `
    import { PropsWithChildren } from 'react';

    export default function App({ children }: PropsWithChildren) {
      return <div>{children};
    }

    const HomePage = () => <App><div>Hello</div></App>
  `;

  await assertRejects(async () => {
    await compileTest(source);
  });
});
