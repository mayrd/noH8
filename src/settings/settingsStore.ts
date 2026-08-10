import { create, useStore } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { SettingsState, Platform } from './types';
import { requestPlatformPermission } from '../permissions/permissions';

// Default platform enablements
const DEFAULT_PLATFORM_STATE: SettingsState['enabledPlatforms'] = {
  youtube: true,
  instagram: true,
  facebook: true,
  tiktok: true,
};

const STORAGE_KEY = 'noH8_settings';

// Create a plain store for use in tests and non-react contexts.
// Mirrors the pattern used in modelStore.ts for consistent Zustand middleware typing.
const createSettingsStore = () => {
  return create<SettingsState>()(
    subscribeWithSelector((set, get) => ({
      enabledPlatforms: { ...DEFAULT_PLATFORM_STATE },
      setEnabledPlatform: (platform: string, enabled: boolean) => {
        // Mutate the existing enabledPlatforms object in place so that
        // previously captured references to the state stay in sync.
        set((state) => {
          state.enabledPlatforms[platform] = enabled;
          return {};
        });
        // When enabling a platform, ask the user to allow parsing its pages.
        if (enabled) {
          void requestPlatformPermission(platform as Platform);
        }
        // Persist to chrome.storage
        const { enabledPlatforms } = get();
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.sync.set(
            { [STORAGE_KEY]: { enabledPlatforms } },
            () => {}
          );
        }
      },
      resetToDefaults: () => {
        set((state) => {
          Object.assign(state.enabledPlatforms, DEFAULT_PLATFORM_STATE);
          return {};
        });
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.sync.set(
            {
              [STORAGE_KEY]: { enabledPlatforms: { ...DEFAULT_PLATFORM_STATE } },
            },
            () => {}
          );
        }
      },
    }))
  );
};

// Export the main store instance
export const settingsStore = createSettingsStore();

// React hook wrapper — reactive via Zustand's useStore so components re-render
// whenever the store state changes.
export const useSettingsStore = (): SettingsState => useStore(settingsStore);

// Helper to initialize store from storage (called once on app load)
export async function initSettingsStore() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY] as { enabledPlatforms?: SettingsState['enabledPlatforms'] } | undefined;
      if (stored?.enabledPlatforms) {
        settingsStore.setState({
          enabledPlatforms: stored.enabledPlatforms,
        });
      }
    });
  }
}