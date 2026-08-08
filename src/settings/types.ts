export type Platform = 'youtube' | 'instagram' | 'facebook' | 'tiktok';

export interface SettingsState {
  enabledPlatforms: Record<Platform, boolean>;
  setEnabledPlatform: (platform: Platform, enabled: boolean) => void;
  resetToDefaults: () => void;
}