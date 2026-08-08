import React from 'react';
import { useSettingsStore } from '../settings/settingsStore';

type Platform = 'youtube' | 'instagram' | 'facebook' | 'tiktok';

const PLATFORM_LABELS: Record<Platform, { label: string; icon: string }> = {
  youtube: { label: 'YouTube', icon: '▶' },
  instagram: { label: 'Instagram', icon: '📷' },
  facebook: { label: 'Facebook', icon: 'f' },
  tiktok: { label: 'TikTok', icon: '🎵' }
};

const SettingsPage: React.FC = () => {
  const { enabledPlatforms, setEnabledPlatform, resetToDefaults } = useSettingsStore();

  const handleToggle = (platform: Platform, checked: boolean) => {
    setEnabledPlatform(platform, checked);
  };

  const handleReset = () => {
    if (confirm('Reset all platform settings to defaults?')) {
      resetToDefaults();
    }
  };

  return (
    <div className="w-80 h-full flex flex-col bg-gray-50">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-800">Extension Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure which platforms to scan</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {Object.entries(PLATFORM_LABELS).map(([platform, config]) => {
            const key = platform as Platform;
            return (
              <div
                key={platform}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{config.icon}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {config.label}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabledPlatforms[key] || false}
                    onChange={(e) => handleToggle(key, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:h-5 after:w-5 after:rounded-full after:transition-all peer-checked:bg-blue-600"></label>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        <button
          onClick={handleReset}
          className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;