import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { registerSW } from 'virtual:pwa-register';

createRoot(document.getElementById("root")!).render(<App />);

// Register the PWA service worker and aggressively check for updates so the app
// doesn't boot into an old cached version.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Auto-apply updates for a "always latest" experience
    updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    // Check once on load, then periodically
    registration?.update();
    window.setInterval(() => registration?.update(), 60_000);
  },
});

