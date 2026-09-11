import { describe, test, expect, vi, beforeEach } from 'vitest';

// Minimal chrome.storage.local mock installed before the store imports.
const localGet = vi.fn((key: string, cb: (items: Record<string, unknown>) => void) =>
  cb({})
);
const localSet = vi.fn(
  (items: Record<string, unknown>, cb?: () => void) => cb?.()
);
const onChangedListener: Record<string, unknown> = {};
const fireStorageChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
  onChangedListener['cb']?.(changes, 'local' as any);
};

const localMock = {
  get: localGet,
  set: localSet,
};
const onChangedMock = {
  addListener: vi.fn((cb: (changes: unknown, area: string) => void) => {
    onChangedListener['cb'] = cb;
  }),
};

global.chrome = {
  storage: { local: localMock, onChanged: onChangedMock },
} as any;

import { modelStore, initModelStore, STORAGE_KEY } from '../../src/settings/modelStore';
import { DEFAULT_MODEL_ID } from '../../src/offscreen/modelCatalog';

describe('ModelStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the shared singleton so tests are independent of execution order.
    modelStore.setState({
      selectedModelId: DEFAULT_MODEL_ID,
      secondaryModelId: null,
      downloadedModels: [],
      modelStatus: {},
      downloadProgress: {},
    });
    localGet.mockImplementation(
      (key, cb) => cb({ [STORAGE_KEY]: { selectedModelId: DEFAULT_MODEL_ID } })
    );
  });

  test('initializes with the default model selected and nothing downloaded', () => {
    const state = modelStore.getState();
    expect(state.selectedModelId).toBe(DEFAULT_MODEL_ID);
    expect(state.downloadedModels).toEqual([]);
  });

  test('selecting a model updates state and persists to storage', () => {
    const state = modelStore.getState();
    state.setSelectedModel('sst-2-english');
    expect(modelStore.getState().selectedModelId).toBe('sst-2-english');
    expect(localSet).toHaveBeenCalledWith(
      {
        [STORAGE_KEY]: {
          selectedModelId: 'sst-2-english',
          secondaryModelId: null,
          downloadedModels: [],
          modelStatus: {},
          downloadProgress: {},
        },
      },
      expect.any(Function)
    );
  });

  test('setting download progress records and persists it', () => {
    const state = modelStore.getState();
    state.setDownloadProgress('toxic-bert', 64);
    expect(modelStore.getState().downloadProgress['toxic-bert']).toBe(64);
    expect(localSet).toHaveBeenCalledWith(
      {
        [STORAGE_KEY]: {
          selectedModelId: DEFAULT_MODEL_ID,
          secondaryModelId: null,
          downloadedModels: [],
          modelStatus: {},
          downloadProgress: { 'toxic-bert': 64 },
        },
      },
      expect.any(Function)
    );
  });

  test('keeps download progress in sync from storage changes', async () => {
    await initModelStore(); // registers the storage.onChanged listener
    fireStorageChanged({
      [STORAGE_KEY]: {
        newValue: {
          selectedModelId: DEFAULT_MODEL_ID,
          downloadedModels: [],
          modelStatus: { 'toxic-bert': 'downloading' },
          downloadProgress: { 'toxic-bert': 80 },
        },
      },
    } as any);
    const state = modelStore.getState();
    expect(state.downloadProgress['toxic-bert']).toBe(80);
  });


  test('marking a model downloaded records and persists it', () => {
    const state = modelStore.getState();
    state.markModelDownloaded('toxic-bert');
    expect(modelStore.getState().downloadedModels).toContain('toxic-bert');
    expect(localSet).toHaveBeenCalled();
  });

  test('unmarking a downloaded model removes it from storage', () => {
    const state = modelStore.getState();
    state.markModelDownloaded('toxic-bert');
    state.unmarkModelDownloaded('toxic-bert');
    expect(modelStore.getState().downloadedModels).not.toContain('toxic-bert');
  });

  test('keeps the model selection and status in sync from storage changes', async () => {
    await initModelStore(); // registers the storage.onChanged listener
    modelStore.getState().setSelectedModel('sst-2-english');
    fireStorageChanged({
      [STORAGE_KEY]: {
        newValue: {
          selectedModelId: 'twitter-roberta',
          downloadedModels: ['twitter-roberta'],
        },
      },
    } as any);
    const state = modelStore.getState();
    expect(state.selectedModelId).toBe('twitter-roberta');
    expect(state.downloadedModels).toContain('twitter-roberta');
  });

  // --- M16: download-failure classification (transient, in-memory) ---

  test('records a failure kind for a model (M16)', () => {
    modelStore.getState().setModelFailure('toxic-bert', 'network');
    expect(modelStore.getState().modelFailures['toxic-bert']).toBe('network');
  });

  test('clearing a failure removes the entry entirely (M16)', () => {
    modelStore.getState().setModelFailure('toxic-bert', 'quota');
    modelStore.getState().setModelFailure('toxic-bert', null);
    expect(modelStore.getState().modelFailures).not.toHaveProperty('toxic-bert');
  });

  test('failures are transient UI state and never persisted to storage (M16)', () => {
    // Trigger a real storage write, then record a failure (which must NOT write).
    modelStore.getState().setSelectedModel('toxic-bert');
    modelStore.getState().setModelFailure('toxic-bert', 'corrupt');
    const write = localSet.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const snapshot = write[STORAGE_KEY] as Record<string, unknown>;
    expect(snapshot).not.toHaveProperty('modelFailures');
  });

  test('marking a model downloaded clears any recorded failure (M16)', () => {
    modelStore.getState().setModelFailure('toxic-bert', 'network');
    modelStore.getState().markModelDownloaded('toxic-bert');
    expect(modelStore.getState().modelFailures).not.toHaveProperty('toxic-bert');
  });

  // --- M17: secondary (consensus) model selection ---

  test('defaults to no secondary model (M17)', () => {
    expect(modelStore.getState().secondaryModelId).toBeNull();
  });

  test('selecting a secondary model updates state and persists it (M17)', () => {
    modelStore.getState().setSecondaryModel('sst-2-english');
    expect(modelStore.getState().secondaryModelId).toBe('sst-2-english');
    expect(localSet).toHaveBeenCalledWith(
      {
        [STORAGE_KEY]: {
          selectedModelId: DEFAULT_MODEL_ID,
          secondaryModelId: 'sst-2-english',
          downloadedModels: [],
          modelStatus: {},
          downloadProgress: {},
        },
      },
      expect.any(Function)
    );
  });

  test('clearing the secondary model removes it from storage (M17)', () => {
    modelStore.getState().setSecondaryModel('sst-2-english');
    modelStore.getState().setSecondaryModel(null);
    expect(modelStore.getState().secondaryModelId).toBeNull();
    const write = localSet.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const snapshot = write[STORAGE_KEY] as Record<string, unknown>;
    expect(snapshot['secondaryModelId']).toBeNull();
  });

  test('refuses to select the primary model as its own secondary (M17)', () => {
    modelStore.getState().setSelectedModel('sst-2-english');
    modelStore.getState().setSecondaryModel('sst-2-english');
    expect(modelStore.getState().secondaryModelId).toBeNull();
  });

  test('hydrates the secondary selection from storage (M17)', async () => {
    localGet.mockImplementation((key, cb) =>
      cb({
        [STORAGE_KEY]: { selectedModelId: DEFAULT_MODEL_ID, secondaryModelId: 'twitter-roberta' },
      })
    );
    await initModelStore();
    expect(modelStore.getState().secondaryModelId).toBe('twitter-roberta');
  });

  test('keeps the secondary selection in sync from storage changes (M17)', async () => {
    await initModelStore(); // registers the storage.onChanged listener
    fireStorageChanged({
      [STORAGE_KEY]: {
        newValue: {
          selectedModelId: DEFAULT_MODEL_ID,
          secondaryModelId: 'twitter-roberta',
          downloadedModels: ['twitter-roberta'],
        },
      },
    } as any);
    expect(modelStore.getState().secondaryModelId).toBe('twitter-roberta');
  });

});