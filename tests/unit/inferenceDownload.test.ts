import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome.storage.local so the model store can persist progress.
const localSet = vi.fn((items: Record<string, unknown>, cb?: () => void) => cb?.());
global.chrome = {
  storage: { local: { get: vi.fn((_, cb) => cb({})), set: localSet } },
} as any;

// Mock the Transformers.js pipeline so we can drive progress + success/failure
// deterministically without booting onnxruntime-wasm.
let pipelineMock = vi.fn();
vi.mock('@xenova/transformers', () => ({
  pipeline: (...args: unknown[]) => pipelineMock(...args),
  env: { backends: { onnx: { wasm: {} } }, allowRemoteModels: false },
}));

import { downloadModel } from '../../src/offscreen/inference';
import { modelStore } from '../../src/settings/modelStore';
import { DEFAULT_MODEL_ID } from '../../src/offscreen/modelCatalog';

describe('downloadModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipelineMock = vi.fn();
    // Reset the shared singleton so tests are independent of execution order.
    modelStore.setState({
      selectedModelId: DEFAULT_MODEL_ID,
      downloadedModels: [],
      modelStatus: {},
      downloadProgress: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('marks the model downloading then ready and forwards progress to the store', async () => {
    let progressCallback: ((e: { status?: string; progress?: number }) => void) | undefined;
    pipelineMock.mockImplementation(
      (
        _task: string,
        _model: string,
        opts: { progress_callback?: (e: { status?: string; progress?: number }) => void }
      ) => {
        progressCallback = opts.progress_callback;
        return Promise.resolve({});
      }
    );

    const downloadPromise = downloadModel('toxic-bert');

    expect(modelStore.getState().modelStatus['toxic-bert']).toBe('downloading');
    expect(modelStore.getState().downloadProgress['toxic-bert']).toBe(0);

    // Simulate Transformers.js progress events while the download streams.
    progressCallback?.({ status: 'progress', progress: 25 });
    progressCallback?.({ status: 'progress', progress: 73.6 });
    expect(modelStore.getState().downloadProgress['toxic-bert']).toBe(74);

    await downloadPromise;

    expect(modelStore.getState().modelStatus['toxic-bert']).toBe('ready');
    expect(modelStore.getState().downloadProgress['toxic-bert']).toBe(100);
    expect(modelStore.getState().downloadedModels).toContain('toxic-bert');
  });

  test('marks the model error and rethrows when the download fails', async () => {
    pipelineMock.mockImplementation(() => Promise.reject(new Error('network timeout')));

    // Use a distinct model id so the shared in-memory PIPELINES cache (seeded by
    // the success test above) does not satisfy this download.
    await expect(downloadModel('sst-2-english')).rejects.toThrow('network timeout');
    expect(modelStore.getState().modelStatus['sst-2-english']).toBe('error');
  });

  test('logs start, progress and success to the console', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    let progressCallback: ((e: { status?: string; progress?: number }) => void) | undefined;
    pipelineMock.mockImplementation(
      (_t: string, _m: string, opts: { progress_callback?: typeof progressCallback }) => {
        progressCallback = opts.progress_callback;
        return Promise.resolve({});
      }
    );

    // Distinct model id again so PIPELINES cache does not short-circuit loading.
    await downloadModel('bert-multilingual');
    progressCallback?.({ status: 'progress', progress: 50 });

    expect(info).toHaveBeenCalledWith(expect.stringContaining('Downloading model'));
    expect(info).toHaveBeenCalledWith(expect.stringContaining('bert-multilingual'));
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('50%'));
    expect(info.mock.calls.some((c) => String(c[0]).includes('ready'))).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });
});
