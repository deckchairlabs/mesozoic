import { serve } from "https://deno.land/std@0.153.0/http/server.ts";
import { createServer } from "ultra/server.ts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./src/app.tsx";

const server = await createServer({
  importMapPath: import.meta.resolve("./importMap.json"),
  browserEntrypoint: import.meta.resolve("./client.tsx"),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      suspense: true,
    },
  },
});

server.get("*", async (context) => {
  /**
   * Render the request
   */
  const result = await server.render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );

  return context.body(result, 200, {
    "content-type": "text/html",
  });
});

serve(server.fetch);
