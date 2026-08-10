import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve(import.meta.dirname, '../../public/manifest.json');

/**
 * Read and parse the extension manifest from the public directory.
 *
 * This manifest mirrors the `defineManifest()` config in `vite.config.ts` and
 * serves as the canonical reference for the extension's permissions and
 * security policy. The CRX plugin generates `dist/manifest.json` from the
 * Vite config at build time, so both source-of-truth locations must stay in
 * sync.
 */
function readManifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

describe('manifest content_security_policy', () => {
  it('declares a content_security_policy with extension_pages', () => {
    const manifest = readManifest();
    expect(manifest.content_security_policy).toBeDefined();
    const csp = (manifest.content_security_policy as Record<string, string>);
    expect(csp.extension_pages).toBeTruthy();
  });

  /**
   * The offscreen document hosts the @xenova/transformers pipeline which
   * compiles ONNX model files into WebAssembly at runtime. Without this
   * token the browser blocks WebAssembly.instantiate() with a CSP violation
   * ("neither 'wasm-eval' nor 'unsafe-eval' is an allowed source").
   */
  it('allows WebAssembly compilation via wasm-unsafe-eval', () => {
    const manifest = readManifest();
    const csp = (manifest.content_security_policy as Record<string, string>);
    expect(csp.extension_pages).toContain("'wasm-unsafe-eval'");
  });

  it('allows same-origin scripts and objects', () => {
    const manifest = readManifest();
    const csp = (manifest.content_security_policy as Record<string, string>);
    expect(csp.extension_pages).toContain("script-src 'self'");
    expect(csp.extension_pages).toContain("object-src 'self'");
  });

  /**
   * The offscreen document and other extension pages must not fall back to
   * the MV3 default (which would strip the wasm permission and break model
   * inference). This guards against the CSP being accidentally removed.
   */
  it('does not reduce script-src to only self (which would block WASM)', () => {
    const manifest = readManifest();
    const csp = (manifest.content_security_policy as Record<string, string>);
    expect(csp.extension_pages).not.toMatch(/^script-src 'self'$/);
    expect(csp.extension_pages).not.toMatch(/script-src 'self';\s*object-src 'self'$/);
    });
});

describe('manifest host permissions', () => {
  /**
   * Chrome warns when an entry in `optional_host_permissions` duplicates one
   * in `host_permissions`, omitting it silently. Since content scripts in MV3
   * require host_permissions to inject, the social media URLs must live in
   * `host_permissions` — making `optional_host_permissions` redundant and
   * causing Chrome to emit noise in the console.
   */
  it('does not declare optional_host_permissions that overlap with host_permissions', () => {
    const manifest = readManifest();
    const hostPerms = new Set(manifest.host_permissions as string[] ?? []);
    const optionalPerms = (manifest.optional_host_permissions as string[]) ?? [];
    const overlap = optionalPerms.filter((p: string) => hostPerms.has(p));

    expect(overlap).toHaveLength(0);
  });
});