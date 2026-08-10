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

const chromePermissionsMock = {
  request: vi.fn().mockResolvedValue(true),
  contains: vi.fn().mockResolvedValue(false),
};

global.chrome = { storage: chromeStorageMock, permissions: chromePermissionsMock } as any;

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

  test('enabling a platform checks then requests permission to parse its pages', async () => {
    const instagramOrigins = [
      'https://www.instagram.com/*',
      'https://m.instagram.com/*',
      'https://instagram.com/*'
    ];
    const state = settingsStore.getState();
    state.setEnabledPlatform('instagram', true);
    // requestPlatformPermission is async (contains → request), flush microtasks
    await new Promise((resolve) => setTimeout(resolve, 0));

    // contains is checked first; since it returns false (not already granted),
    // request is then called.
    expect(chromePermissionsMock.contains).toHaveBeenCalledWith({ origins: instagramOrigins });
    expect(chromePermissionsMock.request).toHaveBeenCalledWith({ origins: instagramOrigins });
  });

  test('disabling a platform does not request additional permissions', () => {
    const state = settingsStore.getState();
    state.setEnabledPlatform('instagram', false);
    expect(chromePermissionsMock.contains).not.toHaveBeenCalled();
    expect(chromePermissionsMock.request).not.toHaveBeenCalled();
  });
});
