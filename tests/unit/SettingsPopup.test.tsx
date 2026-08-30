import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';

const enabledPlatforms = { youtube: true, instagram: false, facebook: true, tiktok: true };
let popupEnabledPlatforms = { ...enabledPlatforms };

vi.mock('../../src/settings/settingsStore', () => ({
  useSettingsStore: () => ({
    enabledPlatforms: popupEnabledPlatforms,
    setEnabledPlatform: vi.fn(),
    resetToDefaults: vi.fn(),
  }),
}));

const mockReadyModelStore = {
  selectedModelId: 'toxic-bert',
  downloadedModels: ['toxic-bert'],
  modelStatus: { 'toxic-bert': 'ready' },
  downloadProgress: {},
};

vi.mock('../../src/settings/modelStore', () => ({
  useModelStore: () => mockReadyModelStore,
}));

const { default: SettingsPopup } = await import('../../src/settings/SettingsPopup');

describe('SettingsPopup', () => {
  const onOpenSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the NoH8 brand title', () => {
    render(<SettingsPopup onOpenSettings={onOpenSettings} />);
    expect(screen.getByText('NoH8')).toBeInTheDocument();
  });

  test('shows the count of enabled platforms out of 4', () => {
    render(<SettingsPopup onOpenSettings={onOpenSettings} />);
    // 3 of 4 platforms are enabled in the mock.
        expect(screen.getByText(/3\/4/)).toBeInTheDocument();
  });

  test('renders a button to open full settings', () => {
    render(<SettingsPopup onOpenSettings={onOpenSettings} />);
    expect(screen.getByRole('button', { name: /open settings/i })).toBeInTheDocument();
  });

  test('clicking the button calls onOpenSettings', async () => {
    const user = userEvent.setup();
    render(<SettingsPopup onOpenSettings={onOpenSettings} />);
    await user.click(screen.getByRole('button', { name: /open settings/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  test('renders a flagged-comments summary row', () => {
    render(<SettingsPopup onOpenSettings={onOpenSettings} />);
    expect(screen.getByText(/flagged/i)).toBeInTheDocument();
  });

  test('popup is constrained to a card width (uses a width utility)', () => {
    const { container } = render(<SettingsPopup onOpenSettings={onOpenSettings} />);
    const popupRoot = container.firstChild as HTMLElement;
    expect(popupRoot.className).toMatch(/w-80|w-72|max-w-/);
  });

  test('shows the welcome setup link when nothing is enabled (empty state)', async () => {
    popupEnabledPlatforms = { youtube: false, instagram: false, facebook: false, tiktok: false };
    const onOpenWelcome = vi.fn();
    const user = userEvent.setup();
    render(<SettingsPopup onOpenSettings={onOpenSettings} onOpenWelcome={onOpenWelcome} />);
    const setupButton = screen.getByRole('button', { name: /set up noh8/i });
    await user.click(setupButton);
    expect(onOpenWelcome).toHaveBeenCalledTimes(1);
    popupEnabledPlatforms = { ...enabledPlatforms };
  });

  test('hides the welcome setup link when a platform is enabled and the model is ready', () => {
    popupEnabledPlatforms = { ...enabledPlatforms };
    render(<SettingsPopup onOpenSettings={onOpenSettings} />);
    expect(screen.queryByRole('button', { name: /set up noh8/i })).not.toBeInTheDocument();
  });
});

