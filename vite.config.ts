import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { defineManifest, crx } from '@crxjs/vite-plugin';

// Read manifest
const manifest = defineManifest({
  manifest_version: 3,
  name: "NoH8",
  description: "Privacy-first hate speech detection directly in your browser",
  version: "0.1.0",
  action: {
    default_popup: "popup.html",
    default_icon: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  permissions: ["storage", "scripting"],
  host_permissions: ["<all_urls>"],
  background: {
    service_worker: "src/background/serviceWorker.js"
  },
  content_scripts: [{
    matches: ["<all_urls>"],
    js: ["src/content/index.ts"]
  }],
  web_accessible_resources: [{
    resources: ["icons/*.png"],
    matches: ["<all_urls>"]
  }],
  icons: {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
});

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  build: {
    rollupOptions: {
      input: {
        popup: new URL('./popup.html', import.meta.url).pathname,
        settings: new URL('./settings.html', import.meta.url).pathname
      }
    }
  }
});
