import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "@/components/theme-provider";
import { COMPACT_VIEW } from "@/store/useAppStore";

import "./index.css";
import "@/i18n";

// The compact panel's window is transparent around the panel (see index.css).
if (COMPACT_VIEW) document.documentElement.dataset.view = "compact";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </ThemeProvider>
  </React.StrictMode>
);

postMessage({ payload: "removeLoading" }, "*");

