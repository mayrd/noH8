import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';

// --- Mock the stores and modules the components depend on -------------------
const enabledPlatforms = { youtube: true, instagram: false, facebook: true, tiktok: true };
const setEnabledPlatform = vi.fn();
const resetToDefaults = vi.fn();
const setReviewOwnCommentDrafts = vi.fn();

vi.mock('../../src/settings/settingsStore', () => ({
  useSettingsStore: () => ({
    enabledPlatforms,
    setEnabledPlatform,
    resetToDefaults,
    reviewOwnCommentDrafts: true,
    setReviewOwnCommentDrafts,
  }),
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

const resetLearnedCalibration = vi.fn();
vi.mock('../../src/offscreen/calibration', () => ({
  resetLearnedCalibration: (...args: unknown[]) => resetLearnedCalibration(...args),
}));

vi.mock('../../src/content/platformConfig', () => ({
  getMatchesForPlatform: (p: string) => [`matches-for-${p}`],
  getAllMatches: () => [],
}));

// Lightweight stub for ModelManager — tested separately.
vi.mock('../../src/settings/ModelManager', () => ({
  default: () => <div data-testid="model-manager">Model Manager Section</div>,
}));

// Lightweight stub for the playground: unit-tested in TestCommentPreview.test.tsx.
// Keeps this suite focused on page wiring without pulling the inference UI.
vi.mock('../../src/settings/TestCommentPreview', () => ({
  default: () => <div data-testid="test-comment-preview">Preview stub</div>,
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
    expect(screen.getByRole('button', { name: 'Reset to Defaults' })).toBeInTheDocument();
  });

  test('clicking reset calls resetToDefaults after confirm', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole('button', { name: 'Reset to Defaults' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(resetToDefaults).toHaveBeenCalled();
  });

  test('does not reset when the user cancels the confirm dialog', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => false);
    render(<SettingsPage />);
    await user.click(screen.getByRole('button', { name: 'Reset to Defaults' }));
    expect(resetToDefaults).not.toHaveBeenCalled();
  });

    test('renders a card-based platform list (not a bare flat list)', () => {
    render(<SettingsPage />);
    const platformSection = screen.getByTestId('platforms-section');
    const cards = within(platformSection).getAllByRole('checkbox');
    expect(cards.length).toBe(4);
  });

  test('renders a toggle for reviewing own comment drafts defaulting to on', () => {
    render(<SettingsPage />);
    const toggle = screen.getByLabelText(/review own comment drafts/i);
    expect(toggle).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });

  test('toggling the draft review switch calls setReviewOwnCommentDrafts', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByLabelText(/review own comment drafts/i));
    expect(setReviewOwnCommentDrafts).toHaveBeenCalledWith(false);
  });

  test('renders a "Reset learned calibration" button that resets after confirm', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const button = screen.getByRole('button', { name: /reset learned calibration/i });
    await user.click(button);
    expect(window.confirm).toHaveBeenCalled();
    expect(resetLearnedCalibration).toHaveBeenCalled();
  });

  test('does not reset learned calibration when the user cancels the confirm', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => false);
    render(<SettingsPage />);
    await user.click(screen.getByRole('button', { name: /reset learned calibration/i }));
    expect(resetLearnedCalibration).not.toHaveBeenCalled();
  });

  // --- M19: settings search & keyboard shortcut -----------------------------

  test('renders a search box that filters sections as you type', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const search = screen.getByRole('searchbox', { name: /search settings/i });
    expect(screen.getByTestId('platforms-section')).toBeInTheDocument();
    expect(screen.getByTestId('models-section')).toBeInTheDocument();

    await user.type(search, 'drafts');
    expect(screen.queryByTestId('platforms-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('handling-section')).toBeInTheDocument();
    expect(screen.queryByTestId('models-section')).not.toBeInTheDocument();
  });

  test('shows an empty-state message when nothing matches', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.type(screen.getByRole('searchbox', { name: /search settings/i }), 'zzz-no-such-setting');
    expect(screen.getByRole('status')).toHaveTextContent(/no settings match/i);
    expect(screen.queryByTestId('platforms-section')).not.toBeInTheDocument();
  });

  test('clearing the search restores all sections', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const search = screen.getByRole('searchbox', { name: /search settings/i });
    await user.type(search, 'drafts');
    expect(screen.queryByTestId('platforms-section')).not.toBeInTheDocument();
    await user.clear(search);
    expect(screen.getByTestId('platforms-section')).toBeInTheDocument();
    expect(screen.getByTestId('handling-section')).toBeInTheDocument();
    expect(screen.getByTestId('models-section')).toBeInTheDocument();
  });

  test('pressing / focuses the search box', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const search = screen.getByRole('searchbox', { name: /search settings/i });
    expect(search).not.toHaveFocus();
    await user.keyboard('/');
    expect(search).toHaveFocus();
  });

  test('pressing Escape in the search box clears the filter', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const search = screen.getByRole('searchbox', { name: /search settings/i });
    await user.type(search, 'drafts');
    expect(screen.queryByTestId('platforms-section')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(search).toHaveValue('');
    expect(screen.getByTestId('platforms-section')).toBeInTheDocument();
  });

  test('renders the try-it-out playground section', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('tryit-section')).toBeInTheDocument();
    expect(screen.getByTestId('test-comment-preview')).toBeInTheDocument();
  });

  test('search filters the try-it-out section as you type', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const search = screen.getByRole('searchbox', { name: /search settings/i });
    await user.type(search, 'drafts');
    expect(screen.queryByTestId('tryit-section')).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'try it');
    expect(screen.getByTestId('tryit-section')).toBeInTheDocument();
    expect(screen.queryByTestId('platforms-section')).not.toBeInTheDocument();
  });
});

