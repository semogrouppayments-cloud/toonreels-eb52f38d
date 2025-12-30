import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { registerSW } from 'virtual:pwa-register';

createRoot(document.getElementById("root")!).render(<App />);

// Register the PWA service worker (auto-update handled by vite-plugin-pwa)
registerSW({ immediate: true });

