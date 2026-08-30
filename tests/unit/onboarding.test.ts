import { describe, test, expect, vi, beforeEach } from 'vitest';

// Callback-style chrome.storage.local mock (mirrors backgroundSetup.test.ts).
const storageStore: Record<string, unknown> = {};
const storageGet = vi.fn(
  (key: string, cb: (items: Record<string, unknown>) => void) => cb({ [key]: storageStore[key] })
);
const storageSet = vi.fn((items: Record<string, unknown>, cb?: () => void) => {
  Object.assign(storageStore, items);
  cb?.();
});

// @ts-expect-error test-only chrome stub
global.chrome = { storage: { local: { get: storageGet, set: storageSet } } };

import {
  ONBOARDING_STORAGE_KEY,
  isOnboarded,
  markOnboarded,
  needsOnboarding,
} from '../../src/settings/onboarding';
import type { Platform } from '../../src/settings/types';

describe('onboarding flag helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete storageStore[ONBOARDING_STORAGE_KEY];
  });

  test('isOnboarded is false when storage is empty (fresh install)', async () => {
    await expect(isOnboarded()).resolves.toBe(false);
  });

  test('markOnboarded persists the flag under noh8_onboarded', async () => {
    await markOnboarded();
    expect(storageSet).toHaveBeenCalledWith(
      { [ONBOARDING_STORAGE_KEY]: true },
      expect.any(Function)
    );
    expect(storageStore[ONBOARDING_STORAGE_KEY]).toBe(true);
  });

  test('isOnboarded is true after markOnboarded', async () => {
    await markOnboarded();
    await expect(isOnboarded()).resolves.toBe(true);
  });

  test('markOnboarded is idempotent (skip and complete share the same flag)', async () => {
    await markOnboarded();
    await markOnboarded();
    await expect(isOnboarded()).resolves.toBe(true);
  });

  test('markOnboarded is a no-op without the chrome API', async () => {
    const globalRef = globalThis as { chrome?: unknown };
    const original = globalRef.chrome;
    // @ts-expect-error test-only
    globalRef.chrome = undefined;
    await expect(markOnboarded()).resolves.toBeUndefined();
    await expect(isOnboarded()).resolves.toBe(false);
    globalRef.chrome = original;
  });
});

describe('needsOnboarding', () => {
  const allPlatforms = (enabled: boolean): Record<Platform, boolean> => ({
    youtube: enabled,
    instagram: enabled,
    facebook: enabled,
    tiktok: enabled,
  });

  const readyModel = {
    selectedModelId: 'toxic-bert',
    downloadedModels: ['toxic-bert'],
    modelStatus: { 'toxic-bert': 'ready' } as Record<string, string>,
  };
  const unreadyModel = {
    selectedModelId: 'toxic-bert',
    downloadedModels: [] as string[],
    modelStatus: {} as Record<string, string>,
  };

  test('true when no platforms are enabled', () => {
    expect(needsOnboarding(allPlatforms(false), readyModel)).toBe(true);
  });

  test('true when the selected model is not ready', () => {
    expect(needsOnboarding(allPlatforms(true), unreadyModel)).toBe(true);
  });

  test('true when nothing is set up at all', () => {
    expect(needsOnboarding(allPlatforms(false), unreadyModel)).toBe(true);
  });

  test('false when at least one platform is enabled and the model is ready', () => {
    expect(needsOnboarding({ ...allPlatforms(false), youtube: true }, readyModel)).toBe(false);
  });

  test('model considered ready when marked ready in modelStatus even if not in downloadedModels', () => {
    expect(
      needsOnboarding(allPlatforms(true), {
        selectedModelId: 'toxic-bert',
        downloadedModels: [],
        modelStatus: { 'toxic-bert': 'ready' },
      })
    ).toBe(false);
  });
});