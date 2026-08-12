import { describe, test, expect, vi } from 'vitest';

// A plain, mutable stand-in for Transformers.js `env` so that the offscreen
// module's module-load-time configuration can be asserted without booting the
// heavy (onnxruntime-wasm) inference pipeline inside the test runner.
//
// `vi.hoisted` is required because the `vi.mock` factory below is hoisted above
// this declaration by Vitest; using a hoisted value avoids a TDZ error.
const { envMock } = vi.hoisted(() => ({
  envMock: {
    allowRemoteModels: false,
    allowLocalModels: true,
    useBrowserCache: false,
    backends: {
      onnx: {
        wasm: {
          // Start multi-threaded + proxy-enabled (mirrors onnxruntime-web's
          // defaults). The offscreen setup must force numThreads to 1 and
          // proxy to false, otherwise onnxruntime-web spins up a web worker
          // from a blob: URL which the MV3 extension CSP blocks.
          numThreads: 4,
          proxy: true,
        },
      },
    },
  },
}));

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(),
  env: envMock,
}));

import { env } from '@xenova/transformers';
import '../../src/offscreen/inference';

describe('offscreen Transformers.js env configuration', () => {
  test('disables threaded wasm so inference stays inside the MV3 CSP', () => {
    // With numThreads > 1 onnxruntime-web loads the threaded WASM build and
    // spawns an Emscripten pthread worker that importScripts()es a blob: URL —
    // which the extension_pages CSP ("script-src 'self' ...") blocks, failing
    // every model download/inference with a NetworkError.
    expect(env.backends.onnx.wasm.numThreads).toBe(1);
  });

  test('disables the proxy worker path (would create another blob worker)', () => {
    expect(env.backends.onnx.wasm.proxy).toBe(false);
  });

  test('keeps remote (Hugging Face) model downloads enabled', () => {
    expect(env.allowRemoteModels).toBe(true);
  });

  test('keeps the browser cache enabled for downloaded models', () => {
    expect(env.useBrowserCache).toBe(true);
  });

  test('does not attempt to read local (unbundled) model weights', () => {
    expect(env.allowLocalModels).toBe(false);
  });
});
