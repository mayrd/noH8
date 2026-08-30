import { describe, test, expect, vi, beforeEach } from 'vitest';

// A stand-in for the Transformers.js module so the loader can be exercised
// without booting the heavy onnxruntime-wasm pipeline inside the test runner.
// The loader must configure `env` for the MV3 extension CSP the first time the
// module is imported (see the long comment in transformersLoader.ts).
const { moduleMock, importSpy } = vi.hoisted(() => {
  const moduleMock = {
    pipeline: vi.fn(),
    env: {
      allowRemoteModels: false,
      allowLocalModels: true,
      useBrowserCache: false,
      backends: {
        onnx: {
          wasm: {
            // Mirror onnxruntime-web defaults: threaded + proxied. The loader
            // must force both off or a blob:-URL worker violates the CSP.
            numThreads: 4,
            proxy: true,
          },
        },
      },
    },
  };
  const importSpy = vi.fn(() => Promise.resolve(moduleMock));
  return { moduleMock, importSpy };
});

import { loadTransformers, resetLoaderForTests } from '../../src/offscreen/transformersLoader';

describe('transformersLoader', () => {
  beforeEach(() => {
    resetLoaderForTests();
    importSpy.mockClear();
    // Restore defaults the loader is expected to flip.
    moduleMock.env.allowRemoteModels = false;
    moduleMock.env.allowLocalModels = true;
    moduleMock.env.useBrowserCache = false;
    moduleMock.env.backends.onnx.wasm.numThreads = 4;
    moduleMock.env.backends.onnx.wasm.proxy = true;
  });

  test('lazily imports the module and applies the MV3-CSP env configuration', async () => {
    expect(importSpy).not.toHaveBeenCalled();

    const mod = await loadTransformers(importSpy);

    expect(importSpy).toHaveBeenCalledTimes(1);
    expect(mod).toBe(moduleMock);
    // Env config is applied on load, before any pipeline call:
    expect(mod.env.allowRemoteModels).toBe(true);
    expect(mod.env.allowLocalModels).toBe(false);
    expect(mod.env.useBrowserCache).toBe(true);
    expect(mod.env.backends.onnx.wasm.numThreads).toBe(1);
    expect(mod.env.backends.onnx.wasm.proxy).toBe(false);
  });

  test('memoizes the import: repeated and concurrent calls import only once', async () => {
    const [a, b] = await Promise.all([loadTransformers(importSpy), loadTransformers(importSpy)]);
    const c = await loadTransformers(importSpy);

    expect(importSpy).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(c).toBe(moduleMock);
  });

  test('retries the import after a failure instead of caching the rejection', async () => {
    importSpy.mockImplementationOnce(() => Promise.reject(new Error('transient failure')));

    await expect(loadTransformers(importSpy)).rejects.toThrow('transient failure');

    const mod = await loadTransformers(importSpy);
    expect(importSpy).toHaveBeenCalledTimes(2);
    expect(mod).toBe(moduleMock);
  });
});
