import { create, useStore } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_MODEL_ID } from '../offscreen/modelCatalog';
import type { ModelFailureKind } from './modelFailure';

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
  /**
   * (M17) Optional secondary model for consensus scoring (flag only on
   * agreement). Null means single-model analysis. Consensus is only applied
   * when the secondary is downloaded (see `resolveConsensusModelId`).
   */
  secondaryModelId: string | null;
  downloadedModels: string[];
  modelStatus: Record<string, ModelStatusId>;
  /** Per-model download progress as a percentage (0–100), shown in the settings UI. */
  downloadProgress: Record<string, number>;
}

export interface ModelStore extends ModelStorageState {
  /** (M16) Classified download failures keyed by model id. In-memory only. */
  modelFailures: Record<string, ModelFailureKind>;
  setSelectedModel: (id: string) => void;
  /**
   * (M17) Configure/clear the secondary (consensus) model. Persisted like the
   * primary selection. A no-op when `id` equals the primary model — a model
   * cannot agree with itself.
   */
  setSecondaryModel: (id: string | null) => void;
  markModelDownloaded: (id: string) => void;
  unmarkModelDownloaded: (id: string) => void;
  setModelStatus: (id: string, status: ModelStatusId) => void;
  setDownloadProgress: (id: string, percent: number) => void;
  /**
   * (M16) Record/clear the classified failure kind for a model. Transient,
   * in-memory UI state only — never persisted (the persisted `error` status
   * alone is enough to re-derive that a retry is possible after a reload).
   */
  setModelFailure: (id: string, kind: ModelFailureKind | null) => void;
}

export const DEFAULT_MODEL_STORAGE: ModelStorageState = {
  selectedModelId: DEFAULT_MODEL_ID,
  /** (M17) No consensus by default — single-model analysis out of the box. */
  secondaryModelId: null,
  downloadedModels: [],
  modelStatus: {},
  downloadProgress: {},
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
    secondaryModelId: next.secondaryModelId,
    downloadedModels: next.downloadedModels,
    modelStatus: next.modelStatus,
    downloadProgress: next.downloadProgress,
  };
  chrome.storage.local.set({ [STORAGE_KEY]: snapshot }, () => {});
}

export const createModelStore = () =>
  create<ModelStore>()(
    subscribeWithSelector((set, get) => ({
      ...DEFAULT_MODEL_STORAGE,
      /** (M16) Classified download failures, keyed by model id. Not persisted. */
      modelFailures: {} as Record<string, ModelFailureKind>,
      setSelectedModel: (id) => {
        set({ selectedModelId: id });
        writeStorage(get());
      },
      setSecondaryModel: (id) => {
        // (M17) A model cannot agree with itself — ignore self-selection.
        if (id !== null && id === get().selectedModelId) return;
        set({ secondaryModelId: id });
        writeStorage(get());
      },
      markModelDownloaded: (id) => {
        if (!get().downloadedModels.includes(id)) {
          set({ downloadedModels: [...get().downloadedModels, id] });
        }
        // (M16) A successful download clears any recorded failure.
        const { [id]: _cleared, ...remainingFailures } = get().modelFailures;
        set({ modelFailures: remainingFailures });
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
      setDownloadProgress: (id, percent) => {
        set({ downloadProgress: { ...get().downloadProgress, [id]: percent } });
        writeStorage(get());
      },
      setModelFailure: (id, kind) => {
        const next = { ...get().modelFailures };
        if (kind === null) {
          delete next[id];
        } else {
          next[id] = kind;
        }
        set({ modelFailures: next });
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
      // (M17) Older persisted states predate the field — default to none.
      secondaryModelId: persisted.secondaryModelId ?? null,
      downloadedModels: persisted.downloadedModels ?? [],
      modelStatus: persisted.modelStatus ?? {},
      downloadProgress: persisted.downloadProgress ?? {},
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
        // (M17) Cross-context secondary sync (settings ↔ offscreen ↔ content).
        secondaryModelId:
          next.secondaryModelId ?? modelStore.getState().secondaryModelId ?? null,
        downloadedModels: next.downloadedModels ?? modelStore.getState().downloadedModels,
        modelStatus: next.modelStatus ?? modelStore.getState().modelStatus,
        downloadProgress: next.downloadProgress ?? modelStore.getState().downloadProgress,
      });
    });
  }
}