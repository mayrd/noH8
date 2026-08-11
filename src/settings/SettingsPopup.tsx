import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../settings/settingsStore';

interface SettingsPopupProps {
  onOpenSettings: () => void;
}

const SettingsPopup: React.FC<SettingsPopupProps> = ({ onOpenSettings }) => {
  const [flaggedCount, setFlaggedCount] = useState(0);
  const { enabledPlatforms } = useSettingsStore();

  // In a real implementation, this would listen to messages from content script
  // about flagged comments on the current page.
  useEffect(() => {
    setFlaggedCount(0);
  }, []);

  const enabledCount = Object.values(enabledPlatforms).filter(Boolean).length;

  return (
    <div className="w-80 p-4 bg-white shadow-xl rounded-xl border border-gray-200">
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌈</span>
          <h3 className="font-semibold text-gray-900 text-lg">NoH8</h3>
        </div>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {enabledCount}/4 platforms
        </span>
      </header>

      {/* Flagged comments summary */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Flagged Comments</span>
          <span className="font-mono text-2xl font-bold text-red-600">{flaggedCount}</span>
        </div>
      </div>

      {/* Open Settings button */}
      <button
        onClick={onOpenSettings}
        className="w-full px-4 py-2.5 text-sm font-medium text-white bg-noh8-600 rounded-lg hover:bg-noh8-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-noh8-500"
      >
        Open Settings
      </button>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Privacy-first hate speech detection
        </p>
<div className="mt-4 pt-3 border-t border-gray-100 flex justify-center space-x-2">\n  <a href=\"https://github.com/your-org/noH8-extension\" target=\"_blank\" rel=\"noopener\" className=\"text-xs text-gray-600 hover:text-noh8-600\">GitHub Repository</a>\n  <a href=\"https://github.com/your-org/noH8-extension/issues\" target=\"_blank\" rel=\"noopener\" className=\"text-xs text-gray-600 hover:text-noh8-600\">Report an Issue</a>\n</div>
      </div>
    </div>
  );
};

export default SettingsPopup;
