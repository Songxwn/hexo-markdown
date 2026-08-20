import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme, readCachedTheme } from "./lib/theme";
import "./styles.css";

applyTheme(readCachedTheme(), { persist: false });

const platform = window.hexo?.platform || "browser";
document.body.classList.add(`platform-${platform}`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
