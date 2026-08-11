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

const DEFAULT_REVIEW_DRAFTS = true;

const STORAGE_KEY = 'noH8_settings';

/** Shape of the persisted settings entry in chrome.storage.sync. */
interface SettingsStorage {
  enabledPlatforms?: Record<Platform, boolean>;
  reviewOwnCommentDrafts?: boolean;
}

// Create a plain store for use in tests and non-react contexts.
// Mirrors the pattern used in modelStore.ts for consistent Zustand middleware typing.
const createSettingsStore = () => {
  return create<SettingsState>()(
    subscribeWithSelector((set, get) => ({
      enabledPlatforms: { ...DEFAULT_PLATFORM_STATE },
      reviewOwnCommentDrafts: DEFAULT_REVIEW_DRAFTS,
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
        const { enabledPlatforms, reviewOwnCommentDrafts } = get();
        persist({ enabledPlatforms, reviewOwnCommentDrafts });
      },
      setReviewOwnCommentDrafts: (enabled: boolean) => {
        set({ reviewOwnCommentDrafts: enabled });
        const { enabledPlatforms, reviewOwnCommentDrafts } = get();
        persist({ enabledPlatforms, reviewOwnCommentDrafts });
      },
      resetToDefaults: () => {
        set((state) => {
          Object.assign(state.enabledPlatforms, DEFAULT_PLATFORM_STATE);
          state.reviewOwnCommentDrafts = DEFAULT_REVIEW_DRAFTS;
          return {};
        });
        persist({
          enabledPlatforms: { ...DEFAULT_PLATFORM_STATE },
          reviewOwnCommentDrafts: DEFAULT_REVIEW_DRAFTS,
        });
      },
    }))
  );
};

/** Write the given settings snapshot to chrome.storage.sync (no-op without chrome). */
function persist(settings: SettingsStorage): void {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {});
  }
}

// Export the main store instance
export const settingsStore = createSettingsStore();

// React hook wrapper — reactive via Zustand's useStore so components re-render
// whenever the store state changes.
export const useSettingsStore = (): SettingsState => useStore(settingsStore);

// Helper to initialize store from storage (called once on app load)
export async function initSettingsStore() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY] as SettingsStorage | undefined;
      if (!stored) return;
      const next: Partial<SettingsState> = {};
      if (stored.enabledPlatforms) {
        next.enabledPlatforms = stored.enabledPlatforms;
      }
      if (typeof stored.reviewOwnCommentDrafts === 'boolean') {
        next.reviewOwnCommentDrafts = stored.reviewOwnCommentDrafts;
      }
      if (Object.keys(next).length > 0) {
        settingsStore.setState(next);
      }
    });
  }
}