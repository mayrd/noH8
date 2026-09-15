import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';

vi.mock('../../src/settings/settingsStore', () => ({
  useSettingsStore: () => ({
    enabledPlatforms: { youtube: true, instagram: true, facebook: true, tiktok: true },
    setEnabledPlatform: vi.fn(),
    resetToDefaults: vi.fn(),
    reviewOwnCommentDrafts: true,
    setReviewOwnCommentDrafts: vi.fn(),
  }),
}));

vi.mock('../../src/settings/modelStore', () => ({
  useModelStore: () => ({
    selectedModelId: 'toxic-bert',
    secondaryModelId: null,
    downloadedModels: ['toxic-bert'],
    modelStatus: {},
    downloadProgress: {},
    setSelectedModel: vi.fn(),
    setSecondaryModel: vi.fn(),
  }),
}));

vi.mock('../../src/offscreen/client', () => ({
  requestModelCommand: vi.fn(),
}));

vi.mock('../../src/offscreen/calibration', () => ({
  resetLearnedCalibration: vi.fn(),
}));

vi.mock('../../src/content/platformConfig', () => ({
  getMatchesForPlatform: (p: string) => [`matches-for-${p}`],
  getAllMatches: () => [],
}));

vi.mock('../../src/settings/ModelManager', () => ({
  default: () => <div data-testid="model-manager">Model Manager Section</div>,
}));

const { default: SettingsPage } = await import('../../src/settings/SettingsPage');

/**
 * RED: Settings page doubles as the welcome screen — it must explain how
 * NoH8 looks and behaves inside social pages (rainbow icon + color meanings).
 */
describe('SettingsPage as welcome screen (how-NoH8-works guide)', () => {
  test('renders a how-it-works guide section', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('how-it-works-section')).toBeInTheDocument();
  });

  test('shows the rainbow icon users will see in comment threads', () => {
    render(<SettingsPage />);
    const section = screen.getByTestId('how-it-works-section');
    // The 🌈 glyph is the exact icon injected next to comments.
    expect(section.textContent).toMatch(/🌈/);
  });

  test('explains flagged (red) vs not-flagged (green) verdict colors', () => {
    render(<SettingsPage />);
    const section = screen.getByTestId('how-it-works-section');
    expect(section.textContent).toMatch(/flagged/i);
    expect(section.textContent).toMatch(/not flagged/i);
  });

  test('mentions 100% on-device privacy in the guide', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('how-it-works-section').textContent).toMatch(
      /on-device|nothing leaves your browser/i
    );
  });
});
