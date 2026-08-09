import { create, useStore } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_MODEL_ID } from '../offscreen/modelCatalog';

/**
 * Client-side store for the on-device ML model the extension uses.
 *
 * Unlike the platform `settingsStore` (which persists to `chrome.storage.sync`),
 * model state is kept in `chrome.storage.local` because it can be large-ish and
 * is regenerated on demand. Because every extension context (popup, settings,
 * offscreen, content) shares the same `chrome.storage.local`, writing from the
 * offscreen pipeline is automatically reflected here via `chrome.storage.onChanged`.
 */

export const STORAGE_KEY = 'noH8_models';

export type ModelStatusId = 'not_downloaded' | 'downloading' | 'ready' | 'error';

export interface ModelStorageState {
  selectedModelId: string;
  downloadedModels: string[];
  modelStatus: Record<string, ModelStatusId>;
}

export interface ModelStore extends ModelStorageState {
  setSelectedModel: (id: string) => void;
  markModelDownloaded: (id: string) => void;
  unmarkModelDownloaded: (id: string) => void;
  setModelStatus: (id: string, status: ModelStatusId) => void;
}

export const DEFAULT_MODEL_STORAGE: ModelStorageState = {
  selectedModelId: DEFAULT_MODEL_ID,
  downloadedModels: [],
  modelStatus: {},
};

function readStorage(): Promise<ModelStorageState | undefined> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve(undefined);
      return;
    }
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const state = result[STORAGE_KEY] as ModelStorageState | undefined;
      resolve(state);
    });
  });
}

function writeStorage(next: ModelStore): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  const snapshot: ModelStorageState = {
    selectedModelId: next.selectedModelId,
    downloadedModels: next.downloadedModels,
    modelStatus: next.modelStatus,
  };
  chrome.storage.local.set({ [STORAGE_KEY]: snapshot }, () => {});
}

export const createModelStore = () =>
  create<ModelStore>()(
    subscribeWithSelector((set, get) => ({
      ...DEFAULT_MODEL_STORAGE,
      setSelectedModel: (id) => {
        set({ selectedModelId: id });
        writeStorage(get());
      },
      markModelDownloaded: (id) => {
        if (get().downloadedModels.includes(id)) return;
        set({ downloadedModels: [...get().downloadedModels, id] });
        writeStorage(get());
      },
      unmarkModelDownloaded: (id) => {
        set({
          downloadedModels: get().downloadedModels.filter((m) => m !== id),
        });
        writeStorage(get());
      },
      setModelStatus: (id, status) => {
        set({ modelStatus: { ...get().modelStatus, [id]: status } });
        writeStorage(get());
      },
    }))
  );

export const modelStore = createModelStore();

/** Reactive React hook bound to the model store (re-renders on state change). */
export const useModelStore = () => useStore(modelStore);

/** Hydrate the store from storage once and keep it in sync across contexts. */
export async function initModelStore(): Promise<void> {
  const persisted = await readStorage();
  if (persisted) {
    modelStore.setState({
      selectedModelId: persisted.selectedModelId ?? DEFAULT_MODEL_ID,
      downloadedModels: persisted.downloadedModels ?? [],
      modelStatus: persisted.modelStatus ?? {},
    });
  }
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      const change = changes[STORAGE_KEY];
      if (!change?.newValue) return;
      const next = change.newValue as ModelStorageState;
      modelStore.setState({
        selectedModelId: next.selectedModelId ?? modelStore.getState().selectedModelId,
        downloadedModels: next.downloadedModels ?? modelStore.getState().downloadedModels,
        modelStatus: next.modelStatus ?? modelStore.getState().modelStatus,
      });
    });
  }
}