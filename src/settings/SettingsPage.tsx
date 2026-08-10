import React from 'react';
import { useSettingsStore } from '../settings/settingsStore';
import { getMatchesForPlatform } from '../content/platformConfig';
import ModelManager from './ModelManager';
import type { Platform } from '../settings/types';

const YOUTUBE_ICON: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M10 15l5-3-5-3v6z" />
    <path d="M21.8 8.001c-.2-2.8-.981-5.19-2.963-7.17C16.857.842 14.476.059 12 0 9.526.059 7.143.842 5.165 2.83 1.983 1.98 3.003 4.88 2.84 7.68-5.5.835-9.88 5.6-10 11.43C-1.94 20.39 1.905 24 6 24c.375 0 .75-.023 1.115-.069.478.979 1.12 1.88 1.96 2.72.835.834 1.815 1.44 2.925 1.78.042.495.096.986.099 1.48.003 4.85-3.275 8.965-8.107 10.48C-2.71 23.73 0 26.88 0 30.5c0 .375.023.75.069 1.115.979.478 1.88 1.12 2.72 1.96.834.835 1.44 1.815 1.78 2.925 1.005.286 2.07.555 3.176.555h.033c4.85-.16 8.965-4.28 10.48-9.112.844-3.794 1.316-7.75.373-11.61.008-.476.015-.951.015-1.426 0-3.808-2.75-6.955-6.535-7.76l-.115-.025C9.234 2.205 12.495 0 16 .06c2.89-.015 5.545 1.227 7.38 3.546.845 1.08 1.52 2.34 1.92 3.73l.04.13c.321-.033.65-.06 1-.06z" />
  </svg>
);
const INSTAGRAM_ICON: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.94.123 5.092.31 4.291.601 3.434.872 2.68 1.624 1.988 2.462.956 3.728.682 5.618.596 6.742C.514 8.024 0 8.362 0 12s.514 3.976 1.67 5.198c.165 2.773 1.004 4.605 2.338 6.177l.038.038c1.237 1.334 2.92.612 3.96 1.94.335.34.74.526 1.18.61.698 1.162 1.893 1.885 3.128 2.188.042.495.096.986.099 1.48.003 4.85-3.275 8.965-8.107 10.48C-2.71 23.73 0 26.88 0 30.5c0 .375.023.75.069 1.115.979.478 1.88 1.12 2.72 1.96.834.835 1.44 1.815 1.78 2.925 1.005.286 2.07.555 3.176.555h.033c4.85-.16 8.965-4.28 10.48-9.112.844-3.794 1.316-7.75.373-11.61.008-.476.015-.951.015-1.426 0-3.808-2.75-6.955-6.535-7.76l-.115-.025C9.234 2.205 12.495 0 16 .06c2.89-.015 5.545 1.227 7.38 3.546.845 1.08 1.52 2.34 1.92 3.73l.04.13c.321-.033.65-.06 1-.06z" />
    <path d="M12 5.838c-3.414 0-6.182 2.768-6.182 6.182 0 2.39.176 3.283.999 5.212.42.992.975 2.007 1.886 2.91.165.16.336.313.513.458.535.405 1.142.724 1.794.948.533.185 1.098.342 1.693.426.285.048.575.072.864.072.289 0 .579-.024.864-.072.595-.084 1.16-.24 1.693-.426.652-.224 1.259-.543 1.794-.948.177-.145.348-.298.513-.458.911-.903 1.466-1.918 1.886-2.91.823-1.929.999-2.822.999-5.212C18.182 8.606 15.414 5.838 12 5.838zm0 10.171c-1.806 0-3.273-1.467-3.273-3.273 0-1.806 1.467-3.273 3.273-3.273 1.806 0 3.273 1.467 3.273 3.273 0 1.806-1.467 3.273-3.273 3.273zm0-5.48c-1.225 0-2.223 1.046-2.223 2.34 0 .632.252 1.203.688 1.646l3.146-3.146c-.028-.298-.133-.572-.32-.786-.224-.245-.53-.376-.818-.401-.356-.03-.719-.033-1.09-.033l.001.001c-.003-.32-.006-.64-.006-.96 0-.114.001-.227.003-.341.012-.236.04-.47.08-.703.023-.147.05-.293.084-.44.009-.048.017-.098.026-.146.01-.044.018-.088.026-.133.01-.052.018-.104.026-.156.006-.045.012-.089.019-.134.01-.044.017-.087.026-.131.005-.033.01-.065.015-.098.002-.016.004-.032.007-.048.002-.012.005-.023.007-.035z" />
  </svg>
);
const FACEBOOK_ICON: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M22.675 0h-21.35C.6 0 0 .6 0 1.625v20.75C0 23.3.6 24 1.625 24h11.07v-9.295H9.69v-3.5h2.01V8.413c0-1.99.73-3.307 3.2-3.307 1.858 0 2.617.136 3.047.262v3.61h-2.09c-.97 0-1.638.672-1.638 1.75v2.27h3.25l-.417 3.5H14.5V24h7.85c1.025 0 1.65-1.05 1.65-2.175V1.625C24 .6 23.375 0 22.675 0z" />
  </svg>
);
const TIKTOK_ICON: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M9.2 18.9c-1.5 0-2.8-.4-3.9-1.1-.4-.3-.7-.6-.9-1-.2-.4-.3-.8-.3-1.3-.1-.5 0-.9.3-1.4.3-.4.7-.8 1.2-1 .5-.3 1.1-.5 1.7-.6-.3-1.3-.5-2-.5-2.8 0-1 .1-1.9.4-2.9.2-1.1.6-2 1.2-2.9.6-.9 1.4-1.7 2.4-2.5 1-.9 2.2-1.5 3.5-2 .3-.1.6-.1.9-.2.3 0 .6 0 .9.1 2.4 1.2 4.2 4.1 4.7 6.9.7 3.9.8 7.8 3.8 10.6.7.7 1.6 1.3 2.5 1.7.2.1.5.2.7.2zm9.5-8.8c-.2-2.5-1.5-4.7-3.6-6 .4-.1.8-.1 1.2-.1 2.3 0 4.3-1.8 4.3-4 .1-.3.2-.6.2-1 .1 2.7 1.6 4.9 3.9 6 .2-.1.3-.2.5-.2.4-.2.7-.4 1-.7-.2 1.9-.8 3.7-1.6 5.4-1.6 3.4-4.2 6.1-7.9 7.3-1.5.5-3.1.8-4.7.8-2.6 0-5-.7-7.2-2 .2-.5.4-.9.6-1.4.4-.8.7-1.6 1-2.5-.3-.1-.6-.2-.9-.3-.2 0-.3 0-.5.1-.6.3-1.2.7-1.7 1.2 0 .1-.1.2-.1.3 2.6 2.1 4.2 5.7 4.2 9.5 0 .6-.1 1.3-.2 1.9 2.7-.7 4.8-3 5.9-5.6.4-.8.7-1.6.9-2.4.1-.5.1-1 .1-1.5z" />
  </svg>
);

const PLATFORM_META: Record<Platform, { label: string; color: string; Icon: React.FC }> = {
  youtube: { label: 'YouTube', color: 'text-red-500', Icon: YOUTUBE_ICON },
  instagram: { label: 'Instagram', color: 'text-pink-500', Icon: INSTAGRAM_ICON },
  facebook: { label: 'Facebook', color: 'text-blue-600', Icon: FACEBOOK_ICON },
  tiktok: { label: 'TikTok', color: 'text-black', Icon: TIKTOK_ICON },
};

const SettingsPage: React.FC = () => {
  const { enabledPlatforms, setEnabledPlatform, resetToDefaults } = useSettingsStore();

  const handleToggle = (platform: Platform, checked: boolean) => {
    setEnabledPlatform(platform, checked);
  };

  const handleReset = () => {
    if (
      confirm(
        'Reset all settings to defaults?\n\nThis will restore the default platform selection and model choice.'
      )
    ) {
      resetToDefaults();
    }
  };

  const enabledCount = Object.values(enabledPlatforms).filter(Boolean).length;

  return (
    <div className="w-full min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Page header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900">NoH8 Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure which platforms to scan and manage your on-device detection model.
        </p>
        <p className="text-xs text-gray-400 mt-1">{enabledCount}/4 platforms active</p>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-10">
          {/* Platforms section */}
          <section data-testid="platforms-section">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Platforms</h2>
            <p className="text-sm text-gray-500 mb-4">
              Turn on the social platforms you want NoH8 to scan for hate speech. When
              enabled for the first time, you'll be asked to grant permission to read those
              sites.
            </p>

            <div className="space-y-3">
              {(Object.keys(PLATFORM_META) as Platform[]).map((platform) => {
                const meta = PLATFORM_META[platform];
                const checked = Boolean(enabledPlatforms[platform]);
                const matches = getMatchesForPlatform(platform);
                return (
                  <div
                    key={platform}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className={meta.color}>{meta.Icon ? <meta.Icon /> : null}</span>
                      <div>
                        <span className="text-sm font-medium text-gray-800 block">
                          {meta.label}
                        </span>
                        <span className="text-xs text-gray-500 block mt-0.5">
                          Scans {matches.length} origin{matches.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Toggle switch */}
                    <label
                      className={`relative inline-flex items-center h-6 w-11 rounded-full cursor-pointer transition-colors ${
                        checked ? 'bg-noh8-600' : 'bg-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => handleToggle(platform, e.target.checked)}
                        aria-label={`Toggle ${meta.label} scanning`}
                        className="sr-only peer"
                      />
                      <span
                        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          checked ? 'translate-x-5' : ''
                        }`}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Model manager section */}
          <section>
            <ModelManager />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-8 py-4">
        <button
          onClick={handleReset}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-noh8-500"
        >
          Reset to Defaults
        </button>
      </footer>
    </div>
  );
};

export default SettingsPage;
