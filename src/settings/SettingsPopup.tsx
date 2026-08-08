import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../settings/settingsStore';

interface SettingsPopupProps {
  onOpenSettings: () => void;
}

const SettingsPopup: React.FC<SettingsPopupProps> = ({ onOpenSettings }) => {
  const [flaggedCount, setFlaggedCount] = useState(0);
  const { enabledPlatforms } = useSettingsStore();

  // In a real implementation, this would listen to messages from content script
  // about flagged comments on the current page
  useEffect(() => {
    // Placeholder: would listen for flagged comments from background script
    setFlaggedCount(0);
  }, []);

  const enabledCount = Object.values(enabledPlatforms).filter(Boolean).length;

  return (
    <div className="w-64 p-3 bg-white shadow-lg rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">NoH8</h3>
        <span className="text-xs text-gray-500">
          {enabledCount}/4 platforms
        </span>
      </div>

      <div className="mb-3 p-2 bg-gray-50 rounded">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Flagged Comments</span>
          <span className="font-mono text-lg font-bold text-red-600">
            {flaggedCount}
          </span>
        </div>
      </div>

      <button
        onClick={onOpenSettings}
        className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        Open Settings
      </button>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Privacy-first hate speech detection
        </p>
      </div>
    </div>
  );
};

export default SettingsPopup;