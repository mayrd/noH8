import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsPage from './SettingsPage';

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(<SettingsPage />);
}