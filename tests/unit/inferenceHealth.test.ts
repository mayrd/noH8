import { describe, test, expect, vi, beforeEach } from 'vitest';

// Callback-style chrome.storage.local mock so the health record round-trips.
const healthStore: Record<string, unknown> = {};
const healthGet = vi.fn(
  (key: string, cb: (items: Record<string, unknown>) => void) => cb({ [key]: healthStore[key] })
);
const healthSet = vi.fn((items: Record<string, unknown>, cb?: () => void) => {
  Object.assign(healthStore, items);
  cb?.();
});
const healthListeners: Array<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void> = [];
global.chrome = {
  storage: {
    local: { get: healthGet, set: healthSet },
    onChanged: {
      addListener: vi.fn((cb: (c: Record<string, chrome.storage.StorageChange>, a: string) => void) => {
        healthListeners.push(cb);
      }),
      removeListener: vi.fn(
        (cb: (c: Record<string, chrome.storage.StorageChange>, a: string) => void) => {
          const i = healthListeners.indexOf(cb);
          if (i >= 0) healthListeners.splice(i, 1);
        }
      ),
    },
  },
} as unknown as typeof chrome;

import {
  INFERENCE_HEALTH_KEY,
  getInferenceHealth,
  recordInferenceHealth,
  subscribeInferenceHealth,
  type InferenceHealth,
} from '../../src/shared/inferenceHealth';

function fireHealthChange(next: InferenceHealth | undefined): void {
  const changes: Record<string, chrome.storage.StorageChange> = {
    [INFERENCE_HEALTH_KEY]: { oldValue: undefined, newValue: next },
  };
  [...healthListeners].forEach((cb) => cb(changes, 'local'));
}

describe('inferenceHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(healthStore)) delete healthStore[k];
  });

  test('records a fallback state to chrome.storage.local (never sync)', () => {
    recordInferenceHealth({ fallbackActive: true, modelId: 'toxic-bert', updatedAt: 123 });
    expect(healthSet).toHaveBeenCalledWith(
      { [INFERENCE_HEALTH_KEY]: { fallbackActive: true, modelId: 'toxic-bert', updatedAt: 123 } },
      expect.any(Function)
    );
    // Guard: the health module must never touch chrome.storage.sync.
    expect((global.chrome.storage as unknown as { sync?: unknown }).sync).toBeUndefined();
  });

  test('round-trips the recorded health via getInferenceHealth', async () => {
    recordInferenceHealth({ fallbackActive: false, modelId: 'sst-2-english', updatedAt: 42 });
    const health = await getInferenceHealth();
    expect(health).toEqual({ fallbackActive: false, modelId: 'sst-2-english', updatedAt: 42 });
  });

  test('returns null when no health has been recorded', async () => {
    expect(await getInferenceHealth()).toBeNull();
  });

  test('returns null when the stored record is malformed', async () => {
    healthStore[INFERENCE_HEALTH_KEY] = { nope: true };
    expect(await getInferenceHealth()).toBeNull();
  });

  test('subscribeInferenceHealth emits parsed records on storage change', async () => {
    const seen: Array<InferenceHealth | null> = [];
    const unsubscribe = subscribeInferenceHealth((h) => seen.push(h));
    fireHealthChange({ fallbackActive: true, modelId: 'm', updatedAt: 1 });
    expect(seen).toEqual([{ fallbackActive: true, modelId: 'm', updatedAt: 1 }]);
    unsubscribe();
    fireHealthChange({ fallbackActive: false, modelId: 'm', updatedAt: 2 });
    expect(seen).toHaveLength(1);
  });

  test('subscribeInferenceHealth emits null for malformed payloads', async () => {
    const seen: Array<InferenceHealth | null> = [];
    const unsubscribe = subscribeInferenceHealth((h) => seen.push(h));
    fireHealthChange(undefined);
    expect(seen).toEqual([null]);
    unsubscribe();
  });
});
