import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { registerSW } from 'virtual:pwa-register';

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes('id-preview--') ||
  window.location.hostname.includes('lovableproject.com');

const clearHeavyRuntimeCaches = async () => {
  if (!('caches' in window)) return;
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name.includes('video-cache') || name.includes('supabase-cache') || name.includes('runtime'))
      .map((name) => caches.delete(name))
  );
};

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

clearHeavyRuntimeCaches().catch(console.error);

createRoot(document.getElementById("root")!).render(<App />);

if (!isPreviewHost && !isInIframe) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      clearHeavyRuntimeCaches().catch(console.error);
      registration?.update();
      window.setInterval(() => registration?.update(), 10 * 60_000);
    },
  });
}

