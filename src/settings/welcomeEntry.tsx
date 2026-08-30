import React from 'react';
import { createRoot } from 'react-dom/client';
import Welcome from './Welcome';
import { initModelStore } from './modelStore';
import { initSettingsStore } from './settingsStore';
import '../index.css';

/**
 * Welcome page entry point. Hydrates both stores from storage before the first
 * render so the toggles reflect the real permission/platform state.
 */
async function mount(): Promise<void> {
  const container = document.getElementById('root');
  if (!container) return;
  await Promise.all([initModelStore(), initSettingsStore()]);
  createRoot(container).render(
    <Welcome
      onFinish={() => {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
      }}
    />
  );
}

void mount();