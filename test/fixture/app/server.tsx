import { serve } from "https://deno.land/std@0.153.0/http/server.ts";
import { createServer } from "ultra/server.ts";
import rehypeHighlight from "https://esm.sh/rehype-highlight@5.0.2/rehype-highlight.js";
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
