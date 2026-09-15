import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../settings/settingsStore';
import { useModelStore } from '../settings/modelStore';
import type { Platform } from '../settings/types';
import { t } from '../shared/i18n';

/** Minimal slice of the model store used to decide whether setup is complete. */
export interface PopupModelState {
  selectedModelId: string;
  downloadedModels: string[];
  modelStatus: Record<string, string>;
}

/**
 * Whether the user still needs the first-run setup: true when no platform is
 * enabled or the selected model has not been downloaded/marked ready.
 * Pure helper (no chrome/storage access) so the popup setup nudge stays testable.
 */
export function needsSetup(
  enabledPlatforms: Record<Platform, boolean>,
  model: PopupModelState
): boolean {
  const anyPlatformEnabled = Object.values(enabledPlatforms ?? {}).some(Boolean);
  const modelReady =
    Boolean(model?.selectedModelId) &&
    (model.downloadedModels?.includes(model.selectedModelId) ||
      model.modelStatus?.[model.selectedModelId] === 'ready');
  return !anyPlatformEnabled || !modelReady;
}

interface SettingsPopupProps {
  onOpenSettings: () => void;
}

const SettingsPopup: React.FC<SettingsPopupProps> = ({ onOpenSettings }) => {
  const [flaggedCount, setFlaggedCount] = useState(0);
  const { enabledPlatforms } = useSettingsStore();
  const { selectedModelId, downloadedModels, modelStatus } = useModelStore();

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
          {t('popup.platformsEnabled', { count: enabledCount })}
        </span>
      </header>

      {/* Setup nudge: opens the settings page (the welcome screen) when nothing is enabled or no model is ready */}
      {needsSetup(enabledPlatforms, { selectedModelId, downloadedModels, modelStatus }) && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full mb-4 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {t('sidepanel.setUp')}
        </button>
      )}

      {/* Flagged comments summary */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">{t('popup.flaggedComments')}</span>
          <span className="font-mono text-2xl font-bold text-red-600">{flaggedCount}</span>
        </div>
      </div>

      {/* Open Settings button */}
      <button
        onClick={onOpenSettings}
        className="w-full px-4 py-2.5 text-sm font-medium text-white bg-noh8-600 rounded-lg hover:bg-noh8-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-noh8-500"
      >
        {t('popup.openSettings')}
      </button>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          {t('popup.tagline')}
        </p>
      </div>
    </div>
  );
};

export default SettingsPopup;
