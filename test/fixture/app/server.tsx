import { serve } from "https://deno.land/std@0.188.0/http/server.ts";
import { createServer } from "ultra/server.ts";
import rehypeHighlight from "https://esm.sh/v122/rehype-highlight@5.0.2/index.mjs";
import App from "./src/app.tsx";

const server = await createServer({
  importMapPath: import.meta.resolve("./importMap.json"),
  browserEntrypoint: import.meta.resolve("./client.tsx"),
});

server.get("*", async (context) => {
  console.log(rehypeHighlight);
  /**
   * Render the request
   */
  const result = await server.render(
    <App />,
  );

  return context.body(result, 200, {
    "content-type": "text/html",
  });
});

serve(server.fetch);
