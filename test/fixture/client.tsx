import {
  Hydrate,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { hydrateRoot } from "react-dom/client";
import App from "./src/app.tsx";

declare const __REACT_QUERY_DEHYDRATED_STATE: unknown;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      suspense: true,
    },
  },
});

hydrateRoot(
  document,
  <QueryClientProvider client={queryClient}>
    <Hydrate state={__REACT_QUERY_DEHYDRATED_STATE}>
      <App />
    </Hydrate>
  </QueryClientProvider>,
);
