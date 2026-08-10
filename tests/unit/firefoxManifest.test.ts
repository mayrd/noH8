import { describe, it, expect } from 'vitest';
import {
  buildFirefoxManifest,
  FIREFOX_GECKO_ID,
  FIREFOX_MIN_VERSION,
} from '../../scripts/package-firefox.mjs';

describe('buildFirefoxManifest', () => {
  it('adds browser_specific_settings.gecko with an id and min version', () => {
    const manifest = buildFirefoxManifest({ version: '0.1.0' });

    expect(manifest.browser_specific_settings.gecko.id).toBe(FIREFOX_GECKO_ID);
    expect(manifest.browser_specific_settings.gecko.strict_min_version).toBe(FIREFOX_MIN_VERSION);
  });

  it('converts background.service_worker to background.scripts for Firefox', () => {
    const manifest = buildFirefoxManifest({
      background: { service_worker: 'service-worker-loader.js', type: 'module' },
    });

    expect(manifest.background.service_worker).toBeUndefined();
    expect(manifest.background.type).toBeUndefined();
    expect(manifest.background.scripts).toEqual(['service-worker-loader.js']);
  });

  it('leaves background untouched when there is no service worker', () => {
    const background = { scripts: ['background.js'] };
    const manifest = buildFirefoxManifest({ background });

    expect(manifest.background).toEqual({ scripts: ['background.js'] });
  });

  it('does not mutate the input manifest', () => {
    const input = { background: { service_worker: 'sw.js', type: 'module' }, version: '1.0.0' };
    buildFirefoxManifest(input);

    expect(input.background.service_worker).toBe('sw.js');
    expect(input.background.type).toBe('module');
    expect(input.browser_specific_settings).toBeUndefined();
  });

  it('preserves the WebAssembly-enabling content_security_policy', () => {
    const input = {
      content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
      },
    };
    const manifest = buildFirefoxManifest(input);

    expect(manifest.content_security_policy).toEqual(
      input.content_security_policy
    );
  });
});
