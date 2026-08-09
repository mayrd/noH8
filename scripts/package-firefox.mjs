import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIREFOX_GECKO_ID = 'noH8@noh8-extension';
export const FIREFOX_MIN_VERSION = '121.0';

/**
 * Transform a Chrome (MV3) manifest into a Firefox-compatible one.
 *
 * - Adds `browser_specific_settings.gecko` (required for distributing to
 *   Firefox Add-ons / for a stable extension id).
 * - Converts `background.service_worker` + `type: "module"` into a Firefox
 *   event page defined via `background.scripts` (Firefox auto-wraps the
 *   listed scripts into an auto-generated background page).
 *
 * The input manifest is never mutated; a deep copy is returned.
 */
export function buildFirefoxManifest(chromeManifest) {
  const manifest = JSON.parse(JSON.stringify(chromeManifest));

  manifest.browser_specific_settings = {
    gecko: {
      id: FIREFOX_GECKO_ID,
      strict_min_version: FIREFOX_MIN_VERSION,
    },
  };

  if (manifest.background && manifest.background.service_worker) {
    manifest.background = { scripts: [manifest.background.service_worker] };
  }

  return manifest;
}

/**
 * Copy the Chrome `dist/` output into a Firefox package directory with a
 * rewritten manifest. Returns the output directory path.
 */
export function prepareFirefoxPackage(distDir, outDir) {
  rmSync(outDir, { recursive: true, force: true });
  cpSync(distDir, outDir, { recursive: true });

  const manifestPath = resolve(outDir, 'manifest.json');
  const chromeManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  writeFileSync(manifestPath, JSON.stringify(buildFirefoxManifest(chromeManifest), null, 2) + '\n');

  return outDir;
}

// Executed directly: `node scripts/package-firefox.mjs [distDir] [outDir]`
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const distDir = resolve(root, process.argv[2] || 'dist');
  const outDir = resolve(root, process.argv[3] || 'dist-firefox');
  prepareFirefoxPackage(distDir, outDir);
  console.log('Firefox package prepared in', outDir);
}