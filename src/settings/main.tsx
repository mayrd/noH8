import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsPage from './SettingsPage';
import { initModelStore } from './modelStore';
import '../index.css';

async function mount() {
  const container = document.getElementById('root');
  if (!container) return;
  // Hydrate model selection/status from storage before first render.
  await initModelStore();
  createRoot(container).render(<SettingsPage />);
}

void mount();