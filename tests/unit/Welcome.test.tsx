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