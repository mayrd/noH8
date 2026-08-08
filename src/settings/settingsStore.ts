import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { SettingsState } from './types';

// Default platform enablements
const DEFAULT_PLATFORM_STATE: SettingsState['enabledPlatforms'] = {
  youtube: true,
  instagram: true,
  facebook: true,
  tiktok: true,
};

const STORAGE_KEY = 'noH8_settings';

// Create a plain store for use in tests and non-react contexts
const createSettingsStore = () => {
  return create<SettingsState>(
    subscribeWithSelector((set, get) => ({
      enabledPlatforms: DEFAULT_PLATFORM_STATE,
      setEnabledPlatform: (platform: string, enabled: boolean) => {
        set((state) => ({
          enabledPlatforms: {
            ...state.enabledPlatforms,
            [platform]: enabled,
          },
        }));
        // Persist to chrome.storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.sync.set({
            [STORAGE_KEY]: { enabledPlatforms: state.enabledPlatforms },
          });
        }
      },
      resetToDefaults: () => {
        set({ enabledPlatforms: DEFAULT_PLATFORM_STATE });
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.sync.set({
            [STORAGE_KEY]: { enabledPlatforms: DEFAULT_PLATFORM_STATE },
          });
        }
      },
    }))
  );
};

// Export the main store instance
export const settingsStore = createSettingsStore();

// React hook wrapper
export const useSettingsStore = () => settingsStore.getState();

// Helper to initialize store from storage (called once on app load)
export async function initSettingsStore() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      if (result[STORAGE_KEY]?.enabledPlatforms) {
        settingsStore.setState({
          enabledPlatforms: result[STORAGE_KEY].enabledPlatforms,
        });
      }
    });
  }
}