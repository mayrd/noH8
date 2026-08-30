import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock chrome.offscreen, chrome.storage.local and chrome.runtime before the module loads.
const hasDocument = vi.fn().mockResolvedValue(false);
const createDocument = vi.fn().mockResolvedValue(undefined);
const storageGet = vi.fn(
  (key: string, cb: (items: Record<string, unknown>) => void) => cb({})
);
const storageSet = vi.fn(
  (items: Record<string, unknown>, cb?: () => void) => cb?.()
);
const runtimeSend = vi.fn().mockResolvedValue({ ok: true, data: 'from-offscreen' });
const tabsCreate = vi.fn();

global.chrome = {
  offscreen: {
    hasDocument,
    createDocument,
    Reason: { WORKERS: 'WORKERS' },
  },
  storage: {
    local: { get: storageGet, set: storageSet },
  },
  runtime: {
    sendMessage: runtimeSend,
    getURL: (path: string) => `chrome-extension://abc/${path}`,
  },
  tabs: { create: tabsCreate },
} as any;

import {
  ensureOffscreenDocument,
  runExtensionSetup,
  handleBackgroundMessage,
  maybeOpenWelcomePage,
} from '../../src/background/setup';

describe('background setup (on-install initialisation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasDocument.mockResolvedValue(false);
    storageGet.mockImplementation(
      (key, cb) => cb({}) // empty storage => not yet initialised
    );
  });

  test('creates the offscreen document when none exists', async () => {
    await ensureOffscreenDocument();
    expect(hasDocument).toHaveBeenCalled();
    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(createDocument.mock.calls[0][0]).toEqual(
      expect.objectContaining({ url: expect.any(String) })
    );
  });

  test('does not create a second offscreen document when one already exists', async () => {
    hasDocument.mockResolvedValue(true);
    await ensureOffscreenDocument();
    expect(createDocument).not.toHaveBeenCalled();
  });

  test('runExtensionSetup seeds default model settings when storage is empty', async () => {
    await runExtensionSetup();
    const setCall = storageSet.mock.calls.find((args) =>
      args[0] && 'noH8_models' in args[0]
    );
    expect(setCall).toBeDefined();
    const payload = setCall![0];
    expect(payload['noH8_models']).toEqual(
      expect.objectContaining({
        selectedModelId: expect.any(String),
        downloadedModels: expect.any(Array),
        modelStatus: expect.any(Object),
      })
    );
    // one-time setup also ensures the offscreen document exists
    expect(createDocument).toHaveBeenCalledTimes(1);
  });

  test('runExtensionSetup does not overwrite existing model settings', async () => {
    storageGet.mockImplementation((key, cb) =>
      cb({
        noH8_models: {
          selectedModelId: 'sst-2-english',
          downloadedModels: ['sst-2-english'],
          modelStatus: { 'sst-2-english': 'ready' },
        },
      })
    );
    await runExtensionSetup();
    const setCall = storageSet.mock.calls.find((args) =>
      args[0] && 'noH8_models' in args[0]
    );
    expect(setCall).toBeUndefined();
  });

  test('runExtensionSetup can be called repeatedly without recreating offscreen', async () => {
    await runExtensionSetup();
    await runExtensionSetup();
    expect(createDocument).toHaveBeenCalledTimes(2);
  });

  test('handleBackgroundMessage ensures offscreen and relays the message through the SW->offscreen bridge', async () => {
    const msg = { type: 'noh8:analyze', text: 'hello world' };
    const result = await handleBackgroundMessage(msg);
    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(runtimeSend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'noh8:analyze', text: 'hello world' })
    );
    expect(result).toEqual({ ok: true, data: 'from-offscreen' });
  });
});

describe('welcome-page onboarding (M12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasDocument.mockResolvedValue(false);
    storageGet.mockImplementation(
      (key, cb) => cb({}) // empty storage => not yet onboarded
    );
  });

  test('opens the welcome page on install when not yet onboarded', async () => {
    await maybeOpenWelcomePage('install');
    expect(tabsCreate).toHaveBeenCalledTimes(1);
    expect(tabsCreate.mock.calls[0][0].url).toContain('welcome.html');
  });

  test('does not open the welcome page for non-install reasons (update/startup)', async () => {
    await maybeOpenWelcomePage('update');
    await maybeOpenWelcomePage('browser_update');
    await maybeOpenWelcomePage('chrome_update');
    expect(tabsCreate).not.toHaveBeenCalled();
  });

  test('does not open the welcome page once onboarding is complete', async () => {
    storageGet.mockImplementation((key, cb) =>
      cb({ noh8_onboarded: true })
    );
    await maybeOpenWelcomePage('install');
    expect(tabsCreate).not.toHaveBeenCalled();
  });
});