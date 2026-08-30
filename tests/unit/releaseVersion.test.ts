import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildFirefoxManifest } from '../../scripts/package-firefox.mjs';

/**
 * The extension version lives in three places that must never drift apart:
 *
 * 1. `package.json` — npm metadata.
 * 2. `public/manifest.json` — canonical Chrome MV3 manifest reference.
 * 3. `vite.config.ts` — the `defineManifest()` the CRX plugin actually uses
 *    to generate `dist/manifest.json` at build time.
 *
 * This suite is also the release gate: when cutting a release, bump
 * `EXPECTED_VERSION` here as part of the change. CI fails until all three
 * files carry the release version, which prevents shipping stale versions
 * (Chrome treats a same-version upload as an update rejection).
 */
const EXPECTED_VERSION = '0.2.0';

const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(import.meta.dirname, path), 'utf8'));
}

/** Extract the manifest `version` string from vite.config.ts source text. */
function readViteManifestVersion(): string {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../vite.config.ts'),
    'utf8'
  );
  const match = /version:\s*"([^"]+)"/.exec(source);
  if (!match) throw new Error('No manifest version found in vite.config.ts');
  return match[1];
}

describe('release version consistency', () => {
  it('uses a valid semver version string', () => {
    expect(EXPECTED_VERSION).toMatch(SEMVER_RE);
  });

  it('declares the release version in package.json', () => {
    const pkg = readJson('../../package.json');
    expect(pkg.version).toBe(EXPECTED_VERSION);
  });

  it('declares the release version in public/manifest.json', () => {
    const manifest = readJson('../../public/manifest.json');
    expect(manifest.version).toBe(EXPECTED_VERSION);
  });

  it('declares the release version in the vite.config.ts defineManifest', () => {
    expect(readViteManifestVersion()).toBe(EXPECTED_VERSION);
  });

  it('keeps all three version locations in sync', () => {
    const pkg = readJson('../../package.json').version;
    const manifest = readJson('../../public/manifest.json').version;
    const vite = readViteManifestVersion();
    expect(new Set([pkg, manifest, vite]).size).toBe(1);
  });

  it('preserves the version through the Firefox manifest transform', () => {
    const manifest = buildFirefoxManifest({ version: EXPECTED_VERSION });
    expect(manifest.version).toBe(EXPECTED_VERSION);
  });
});
