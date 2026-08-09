import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsPopup from './SettingsPopup';

const container = document.getElementById('root');

if (container) {
  // Open the full settings page in a dedicated tab.
  const onOpenSettings = () => {
    const settingsUrl = chrome.runtime.getURL('settings.html');
    chrome.tabs.create({ url: settingsUrl });
  };

  createRoot(container).render(<SettingsPopup onOpenSettings={onOpenSettings} />);
}