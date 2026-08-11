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

import { settingsStore, initSettingsStore } from '../../src/settings/settingsStore';

// Initialize the store with a proper mock state
initSettingsStore();

describe('SettingsStore', () => {
  beforeEach(() => {
    // Reset the store to its initial state instead of trying to mock chrome storage
    settingsStore.setState({
      enabledPlatforms: { youtube: true, instagram: true, facebook: true, tiktok: true },
      reviewOwnCommentDrafts: true
    });
    vi.clearAllMocks();
  });

  test('initializes with default values', () => {
    const state = settingsStore.getState();
    expect(state.enabledPlatforms.youtube).toBe(true);
    expect(state.enabledPlatforms.instagram).toBe(true);
    expect(state.enabledPlatforms.facebook).toBe(true);
    expect(state.enabledPlatforms.tiktok).toBe(true);
    expect(state.reviewOwnCommentDrafts).toBe(true);
  });

  test('setEnabledPlatform updates state and storage', () => {
    const state = settingsStore.getState();
    state.setEnabledPlatform('instagram', false);
    expect(state.enabledPlatforms.instagram).toBe(false);
    expect(chromeStorageMock.sync.set).toHaveBeenCalledWith(
      {
        noH8_settings: {
          enabledPlatforms: { youtube: true, instagram: false, facebook: true, tiktok: true },
          reviewOwnCommentDrafts: true,
        },
      },
      expect.any(Function)
    );
  });

  test('resetToDefaults restores default platforms and review setting', () => {
    const state = settingsStore.getState();
    state.setEnabledPlatform('instagram', false);
    state.setReviewOwnCommentDrafts(false);
    state.resetToDefaults();
    expect(state.enabledPlatforms).toEqual({
      youtube: true,
      instagram: true,
      facebook: true,
      tiktok: true
    });
    expect(state.reviewOwnCommentDrafts).toBe(true);
  });

  test('reviewOwnCommentDrafts defaults to on', () => {
    const state = settingsStore.getState();
    expect(state.reviewOwnCommentDrafts).toBe(true);
  });

  test('setReviewOwnCommentDrafts updates state and storage', () => {
    const state = settingsStore.getState();
    state.setReviewOwnCommentDrafts(false);
    expect(state.reviewOwnCommentDrafts).toBe(false);
    expect(chromeStorageMock.sync.set).toHaveBeenCalledWith(
      {
        noH8_settings: expect.objectContaining({
          reviewOwnCommentDrafts: false,
        }),
      },
      expect.any(Function)
    );
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
