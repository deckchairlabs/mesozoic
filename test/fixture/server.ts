import { createElement } from "react";
import { renderToString } from "https://esm.sh/react-dom@18.2.0/server";
import App from "./src/app.tsx";

console.log(renderToString(createElement(App)));
