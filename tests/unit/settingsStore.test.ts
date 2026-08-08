import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock chrome.storage BEFORE importing the store
const chromeStorageMock = {
  sync: {
    get: vi.fn((key, callback) => {
      callback({});
    }),
    set: vi.fn((items, callback) => callback())
  }
};

global.chrome = { storage: chromeStorageMock } as any;

import { settingsStore } from '../../src/settings/settingsStore';

describe('SettingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('initializes with default values', () => {
    const state = settingsStore.getState();
    expect(state.enabledPlatforms.youtube).toBe(true);
    expect(state.enabledPlatforms.instagram).toBe(true);
    expect(state.enabledPlatforms.facebook).toBe(true);
    expect(state.enabledPlatforms.tiktok).toBe(true);
  });

  test('setEnabledPlatform updates state and storage', () => {
    const state = settingsStore.getState();
    state.setEnabledPlatform('instagram', false);
    expect(state.enabledPlatforms.instagram).toBe(false);
    expect(chromeStorageMock.sync.set).toHaveBeenCalledWith(
      { noH8_settings: { enabledPlatforms: { youtube: true, instagram: false, facebook: true, tiktok: true } } },
      expect.any(Function)
    );
  });

  test('resetToDefaults restores default platforms', () => {
    const state = settingsStore.getState();
    state.setEnabledPlatform('instagram', false);
    state.resetToDefaults();
    expect(state.enabledPlatforms).toEqual({
      youtube: true,
      instagram: true,
      facebook: true,
      tiktok: true
    });
  });
});
