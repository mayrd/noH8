import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the permission seam so toggles can be asserted against it.
vi.mock('../../src/permissions/permissions', () => ({
  requestPlatformPermission: vi.fn().mockResolvedValue(true),
  isPlatformAccessible: vi.fn().mockResolvedValue(true),
}));

// Mock the offscreen command client (model download nudge).
vi.mock('../../src/offscreen/client', () => ({
  requestModelCommand: vi.fn().mockResolvedValue(undefined),
  requestAnalyze: vi.fn(),
}));

// Callback-style chrome mock used by the real settings/model/onboarding stores.
const localStore: Record<string, unknown> = {};
const syncStore: Record<string, unknown> = {};
global.chrome = {
  storage: {
    local: {
      get: (key: string, cb: (r: Record<string, unknown>) => void) => cb({ [key]: localStore[key] }),
      set: (items: Record<string, unknown>, cb?: () => void) => {
        Object.assign(localStore, items);
        cb?.();
      },
    },
    sync: {
      get: (key: string, cb: (r: Record<string, unknown>) => void) => cb({ [key]: syncStore[key] }),
      set: (items: Record<string, unknown>, cb?: () => void) => {
        Object.assign(syncStore, items);
        cb?.();
      },
    },
  },
  tabs: { create: vi.fn() },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

import { Welcome } from '../../src/settings/Welcome';
import { requestPlatformPermission } from '../../src/permissions/permissions';
import { requestModelCommand } from '../../src/offscreen/client';
import { ONBOARDING_STORAGE_KEY } from '../../src/settings/onboarding';
import { findModelDescriptor } from '../../src/offscreen/modelCatalog';
import { settingsStore } from '../../src/settings/settingsStore';
import { modelStore } from '../../src/settings/modelStore';

describe('Welcome (first-run onboarding flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete localStore[ONBOARDING_STORAGE_KEY];
    // Reset stores to defaults between tests.
    settingsStore.setState({
      enabledPlatforms: { youtube: true, instagram: true, facebook: true, tiktok: true },
      reviewOwnCommentDrafts: true,
    });
    modelStore.setState({
      selectedModelId: modelStore.getState().selectedModelId,
      downloadedModels: [],
      modelStatus: {},
      downloadProgress: {},
    });
  });

  test('renders the privacy promise copy', () => {
    render(<Welcome />);
    expect(screen.getByText(/nothing leaves your browser/i)).toBeInTheDocument();
  });

  test('rendering a platform toggle and enabling it requests the platform permission', async () => {
    const user = userEvent.setup();
    render(<Welcome />);
    // All platforms start enabled; toggle youtube off then on again.
    const toggle = screen.getByRole('checkbox', { name: /youtube/i });
    await user.click(toggle);
    await user.click(toggle);
    expect(requestPlatformPermission).toHaveBeenCalledWith('youtube');
  });

  test('model download nudge sends a download command for the selected model', async () => {
    const user = userEvent.setup();
    render(<Welcome />);
    await user.click(screen.getByRole('button', { name: /download/i }));
    await waitFor(() => {
      expect(requestModelCommand).toHaveBeenCalledWith('download', expect.any(String));
    });
  });

  test('shows a progress bar with the current percent while downloading', () => {
    const modelId = modelStore.getState().selectedModelId;
    modelStore.setState({
      modelStatus: { [modelId]: 'downloading' },
      downloadProgress: { [modelId]: 42 },
    });
    render(<Welcome />);
    expect(screen.getByTestId('welcome-model-progress')).toBeInTheDocument();
    expect(screen.getByText(/42%/)).toBeInTheDocument();
    expect(
      screen.getByTestId('welcome-model-progress-bar').style.width
    ).toBe('42%');
  });

  test('tells the user it is safe to leave while the download continues', () => {
    const modelId = modelStore.getState().selectedModelId;
    modelStore.setState({ modelStatus: { [modelId]: 'downloading' } });
    render(<Welcome />);
    const info = screen.getByTestId('welcome-model-safe');
    expect(info).toHaveTextContent(/safe/i);
    expect(info).toHaveTextContent(/get started/i);
    expect(info).toHaveTextContent(/background/i);
  });

  test('re-enables the download button with a failure message on error', async () => {
    const modelId = modelStore.getState().selectedModelId;
    modelStore.setState({ modelStatus: { [modelId]: 'error' } });
    const user = userEvent.setup();
    render(<Welcome />);
    expect(screen.getByTestId('welcome-model-failed')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /download/i });
    expect(retryButton).toBeEnabled();
    await user.click(retryButton);
    expect(requestModelCommand).toHaveBeenCalledWith('download', modelId);
  });

  test('names the model that will be downloaded in step 2', () => {
    const modelId = modelStore.getState().selectedModelId;
    render(<Welcome />);
    const step2 = screen.getByTestId('welcome-model-name');
    expect(step2).toHaveTextContent(new RegExp(modelId, 'i'));
    // The name comes from the catalog, not the raw id.
    const catalog = findModelDescriptor(modelId);
    expect(catalog).toBeDefined();
    expect(step2).toHaveTextContent(catalog!.name);
  });

  test('step 3 toggle for own-draft review flips the setting', async () => {
    const user = userEvent.setup();
    render(<Welcome />);
    const toggle = screen.getByRole('checkbox', { name: /review my own comment drafts/i });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(settingsStore.getState().reviewOwnCommentDrafts).toBe(false);
    await user.click(toggle);
    expect(settingsStore.getState().reviewOwnCommentDrafts).toBe(true);
  });

  test('completing the flow persists the onboarding flag', async () => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<Welcome onFinish={onFinish} />);
    await user.click(screen.getByRole('button', { name: /get started/i }));
    await waitFor(() => expect(localStore[ONBOARDING_STORAGE_KEY]).toBe(true));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  test('skipping the flow also persists the onboarding flag', async () => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<Welcome onFinish={onFinish} />);
    await user.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(localStore[ONBOARDING_STORAGE_KEY]).toBe(true));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});