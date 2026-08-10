import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { defineManifest, crx } from '@crxjs/vite-plugin';
import { getAllMatches } from './src/content/platformConfig';

// Host match patterns for the pages the extension should parse. Scoping the
// manifest to these origins prompts the user to allow parsing these sites and
// prevents the extension from touching unrelated pages.
const PLATFORM_MATCHES = getAllMatches();

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
  permissions: ["storage", "scripting", "offscreen"],
  host_permissions: [
    ...PLATFORM_MATCHES,
    "https://huggingface.co/*",
    "https://cdn-lfs.huggingface.co/*",
    "https://cdn.jsdelivr.net/*"
  ],
  // Social media URLs live in host_permissions (required so that the static
  // content_scripts can inject). They are NOT also listed under
  // optional_host_permissions — doing so makes that field entirely redundant
  // and Chrome emits a warning for every overlapping entry.
  background: {
    service_worker: "src/background/serviceWorker.ts"
  },
  content_scripts: [{
    matches: PLATFORM_MATCHES,
    js: ["src/content/index.ts"]
  }],
  // Allow WebAssembly compilation in the offscreen document where the
  // @xenova/transformers ONNX runtime runs. Without 'wasm-unsafe-eval' the
  // MV3 default CSP (script-src 'self') blocks WebAssembly.instantiate()
  // and model download/inference fails.
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
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
        settings: new URL('./settings.html', import.meta.url).pathname,
        offscreen: new URL('./src/offscreen/offscreen.html', import.meta.url).pathname
      }
    }
  }
});
