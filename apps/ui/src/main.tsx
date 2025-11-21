import { NuqsAdapter } from "@beztack/state/adapters/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import "./index.css";
import "./lib/i18n/i18n";

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed to exist in index.html
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NuqsAdapter>
      <App />
    </NuqsAdapter>
  </StrictMode>
);
