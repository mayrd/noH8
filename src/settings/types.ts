export type Platform = 'youtube' | 'instagram' | 'facebook' | 'tiktok';

export interface SettingsState {
  enabledPlatforms: Record<Platform, boolean>;
  /** Whether the "review own comment drafts" feature is enabled (default: true). */
  reviewOwnCommentDrafts: boolean;
  setEnabledPlatform: (platform: Platform, enabled: boolean) => void;
  /** Toggle the "review own comment drafts" feature. */
  setReviewOwnCommentDrafts: (enabled: boolean) => void;
  resetToDefaults: () => void;
}