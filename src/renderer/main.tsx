import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppProvider } from "./contexts/AppContext";
import RendererErrorBoundary from "./components/RendererErrorBoundary";
import { installPreviewBridge } from "./dev/installPreviewBridge";
import { applyThemePreference, installThemeSync } from "./themePreference";
import "./styles/index.css";

installPreviewBridge();

const isLocalPreview = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const previewTheme = isLocalPreview ? new URLSearchParams(window.location.search).get('theme') : null;
if (previewTheme === 'dark' || previewTheme === 'light') {
  applyThemePreference(previewTheme);
} else {
  installThemeSync();
}

/**
 * 平台适配：为 macOS 添加特定样式类
 */
if (window.electronEnv?.platform === "darwin") {
  document.documentElement.classList.add("platform-darwin");
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Error: HTML中缺少 id="root" 元素，React无法挂载');
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <RendererErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </RendererErrorBoundary>
  </StrictMode>,
);
