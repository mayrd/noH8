import { describe, test, expect, vi, beforeEach } from 'vitest';

import { createProgressReporter } from '../../src/offscreen/downloadProgress';

/**
 * Progress-on-file-size unit tests for the Transformers.js progress reporter:
 * per-file loaded/total aggregation, percent-only fallback, lifecycle events.
 */

const localStore: Record<string, unknown> = {};
const localSet = vi.fn((items: Record<string, unknown>, cb?: () => void) => {
  Object.assign(localStore, items);
  cb?.();
});
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: { get: vi.fn((_, cb: (v: unknown) => void) => cb({ ...localStore })), set: localSet },
  },
} as unknown;

let pipelineMock = vi.fn();
vi.mock('@xenova/transformers', () => ({
  pipeline: (...args: unknown[]) => pipelineMock(...args),
  env: { backends: { onnx: { wasm: {} } }, allowRemoteModels: false },
}));

import { MODEL_CATALOG, formatBytes } from '../../src/offscreen/modelCatalog';
import { modelStore } from '../../src/settings/modelStore';
import { downloadModel } from '../../src/offscreen/inference';

describe('model file sizes (RED)', () => {
  test('every catalog model exposes a positive sizeBytes', () => {
    expect(MODEL_CATALOG.length).toBeGreaterThan(0);
    for (const model of MODEL_CATALOG) {
      expect(
        (model as { sizeBytes?: unknown }).sizeBytes,
        `${model.id} should expose sizeBytes`
      ).toEqual(expect.any(Number));
      expect((model as { sizeBytes: number }).sizeBytes).toBeGreaterThan(0);
    }
  });

  test('formatBytes renders bytes as human-readable sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(110720344)).toContain('MB');
    expect(formatBytes(67581197)).toContain('MB');
  });
});

describe('download byte progress (RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipelineMock = vi.fn();
    for (const k of Object.keys(localStore)) delete localStore[k];
    modelStore.setState({
      downloadedModels: [],
      modelStatus: {},
      downloadProgress: {},
      downloadDetails: {},
    });
  });

  test('streams loaded/total bytes per file into the store', async () => {
    let progressCallback:
      | ((e: { status?: string; file?: string; progress?: number; loaded?: number; total?: number }) => void)
      | undefined;
    let resolvePipeline!: (value: unknown) => void;
    pipelineMock.mockImplementation(
      (
        _task: string,
        _model: string,
        opts: { progress_callback?: typeof progressCallback }
      ) => {
        progressCallback = opts.progress_callback;
        return new Promise((resolve) => {
          resolvePipeline = resolve;
        });
      }
    );

    const pending = downloadModel('sst-2-english');
    await vi.waitUntil(() => progressCallback !== undefined);

    progressCallback?.({
      status: 'progress',
      file: 'onnx/model_quantized.onnx',
      progress: 50,
      loaded: 33790598,
      total: 67581197,
    });

    const detail = modelStore.getState().downloadDetails['sst-2-english'];
    expect(detail).toBeDefined();
    expect(detail.loadedBytes).toBe(33790598);
    expect(detail.totalBytes).toBe(67581197);
    expect(detail.percent).toBe(50);

    resolvePipeline({});
    await pending;
  });

  test('a completed download is marked downloaded + ready with full bytes', async () => {
    pipelineMock.mockImplementation(() => Promise.resolve({}));
    await downloadModel('sst-2-english');
    const state = modelStore.getState();
    expect(state.downloadedModels).toContain('sst-2-english');
    expect(state.modelStatus['sst-2-english']).toBe('ready');
    expect(state.downloadDetails['sst-2-english']?.percent).toBe(100);
    expect(state.downloadDetails['sst-2-english']?.loadedBytes).toBe(
      state.downloadDetails['sst-2-english']?.totalBytes
    );
  });

  test('percent-only events fall back to the legacy percent path', () => {
    const report = createProgressReporter('sst-2-english', 67581197);
    report({ status: 'progress', progress: 73.6 });
    expect(modelStore.getState().downloadProgress['sst-2-english']).toBe(74);
  });

  test('lifecycle events only track the current file name', () => {
    const report = createProgressReporter('sst-2-english', 67581197);
    report({ status: 'initiate', file: 'tokenizer.json' });
    expect(modelStore.getState().downloadDetails['sst-2-english']).toBeUndefined();
    report({ status: 'progress', file: 'tokenizer.json', loaded: 100, total: 200 });
    expect(modelStore.getState().downloadDetails['sst-2-english']?.file).toBe('tokenizer.json');
  });

  test('aggregates per-file bytes across multiple files', () => {
    const report = createProgressReporter('sst-2-english', 0);
    report({ status: 'progress', file: 'tokenizer.json', loaded: 200, total: 200 });
    report({ status: 'progress', file: 'onnx/model_quantized.onnx', loaded: 50, total: 100 });
    const detail = modelStore.getState().downloadDetails['sst-2-english'];
    // (200 + 50) / (200 + 100) = 83%
    expect(detail?.loadedBytes).toBe(250);
    expect(detail?.totalBytes).toBe(300);
    expect(detail?.percent).toBe(83);
  });
});
