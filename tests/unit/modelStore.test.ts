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
          downloadedModels: [],
          modelStatus: {},
        },
      },
      expect.any(Function)
    );
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
});