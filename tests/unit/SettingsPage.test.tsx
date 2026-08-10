import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';

// --- Mock the stores and modules the components depend on -------------------
const enabledPlatforms = { youtube: true, instagram: false, facebook: true, tiktok: true };
const setEnabledPlatform = vi.fn();
const resetToDefaults = vi.fn();

vi.mock('../../src/settings/settingsStore', () => ({
  useSettingsStore: () => ({ enabledPlatforms, setEnabledPlatform, resetToDefaults }),
}));

vi.mock('../../src/settings/modelStore', () => ({
  useModelStore: () => ({
    selectedModelId: 'toxic-bert',
    downloadedModels: ['toxic-bert'],
    modelStatus: {},
    setSelectedModel: vi.fn(),
    markModelDownloaded: vi.fn(),
    unmarkModelDownloaded: vi.fn(),
    setModelStatus: vi.fn(),
  }),
}));

vi.mock('../../src/offscreen/client', () => ({
  requestModelCommand: vi.fn(),
}));

vi.mock('../../src/content/platformConfig', () => ({
  getMatchesForPlatform: (p: string) => [`matches-for-${p}`],
  getAllMatches: () => [],
}));

// Lightweight stub for ModelManager — tested separately.
vi.mock('../../src/settings/ModelManager', () => ({
  default: () => <div data-testid="model-manager">Model Manager Section</div>,
}));

// Load the component AFTER the mocks are registered.
const { default: SettingsPage } = await import('../../src/settings/SettingsPage');

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  test('renders a page header with a title and description', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: /noh8 settings/i })).toBeInTheDocument();
    expect(screen.getByText(/configure which platforms/i)).toBeInTheDocument();
  });

  test('renders a toggle switch for every supported platform', () => {
    render(<SettingsPage />);
    for (const p of ['youtube', 'instagram', 'facebook', 'tiktok']) {
      expect(screen.getByLabelText(new RegExp(p, 'i'))).toBeInTheDocument();
    }
  });

  test('platform toggles reflect the current enabled state', () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText(/youtube/i)).toBeChecked();
    expect(screen.getByLabelText(/instagram/i)).not.toBeChecked();
  });

  test('toggling a disabled platform on calls setEnabledPlatform(true)', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByLabelText(/instagram/i));
    expect(setEnabledPlatform).toHaveBeenCalledWith('instagram', true);
  });

  test('toggling an enabled platform off calls setEnabledPlatform(false)', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByLabelText(/youtube/i));
    expect(setEnabledPlatform).toHaveBeenCalledWith('youtube', false);
  });

  test('renders the Model Manager section', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('model-manager')).toBeInTheDocument();
  });

  test('renders a reset button', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  test('clicking reset calls resetToDefaults after confirm', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(window.confirm).toHaveBeenCalled();
    expect(resetToDefaults).toHaveBeenCalled();
  });

  test('does not reset when the user cancels the confirm dialog', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => false);
    render(<SettingsPage />);
    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(resetToDefaults).not.toHaveBeenCalled();
  });

  test('renders a card-based platform list (not a bare flat list)', () => {
    render(<SettingsPage />);
    const platformSection = screen.getByTestId('platforms-section');
    const cards = within(platformSection).getAllByRole('checkbox');
    expect(cards.length).toBe(4);
  });
});

