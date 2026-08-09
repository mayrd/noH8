import {
  DEFAULT_MODEL_STORAGE,
  STORAGE_KEY,
  type ModelStorageState,
} from '../settings/modelStore';
import type { NoH8Request, NoH8Response } from '../shared/messages';

/**
 * Background service worker setup + routing.
 *
 * The heavy lifting (Transformers.js) runs in an **offscreen document**, which
 * Manifest V3 requires to host WebAssembly/WebGPU work. This module:
 *  1. creates the offscreen document once,
 *  2. seeds default model settings the first time the extension is installed,
 *  3. relays messages from content/settings to the offscreen pipeline.
 */

const OFFScreen_URL = 'src/offscreen/offscreen.html';
const OFFScreen_REASON = 'WORKERS';

function hasOffscreenApi(): boolean {
  return Boolean(
    typeof chrome !== 'undefined' && chrome.offscreen && chrome.offscreen.createDocument
  );
}

/**
 * Create the offscreen document if it does not already exist. No-ops on
 * browsers that do not support the offscreen API (e.g. Firefox).
 */
export async function ensureOffscreenDocument(): Promise<boolean> {
  if (!hasOffscreenApi()) return false;
  try {
    const exists = await chrome.offscreen.hasDocument();
    if (!exists) {
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL(OFFScreen_URL),
        reasons: [chrome.offscreen.Reason[OFFScreen_REASON] as chrome.offscreen.Reason],
        justification:
          'Runs the on-device Transformers.js model for privacy-first hate speech analysis.',
      });
    }
    return true;
  } catch (error) {
    console.warn('[NoH8] could not ensure offscreen document exists:', error);
    return false;
  }
}

/**
 * One-time setup that runs when the extension is installed (and is safe to run
 * on service worker startup). Seeds default model settings if absent and makes
 * sure the offscreen document exists.
 */
export async function runExtensionSetup(): Promise<void> {
  await seedModelSettings();
  await ensureOffscreenDocument();
}

/**
 * Write the default model settings to `chrome.storage.local` only if they have
 * never been stored before (first install / migration).
 */
export async function seedModelSettings(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  const existing = await new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => resolve(result ?? {}));
  });
  if (existing[STORAGE_KEY] !== undefined) return; // already initialised

  const defaults: ModelStorageState = {
    selectedModelId: DEFAULT_MODEL_STORAGE.selectedModelId,
    downloadedModels: [],
    modelStatus: {},
  };
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: defaults }, () => resolve());
  });
}

/**
 * Route a request to the offscreen document. Ensures the offscreen document is
 * alive first, marks the message so the offscreen doc knows to process it, and
 * returns the offscreen's response.
 */
export async function handleBackgroundMessage(
  message: NoH8Request
): Promise<NoH8Response> {
  await ensureOffscreenDocument();
  const relayed: NoH8Request = { ...message, relayed: true };
  const response = (await chrome.runtime.sendMessage(relayed)) as NoH8Response;
  // chrome.runtime.sendMessage resolves `undefined` when no listener responds.
  if (!response) {
    return { ok: false, error: 'No response from the offscreen pipeline.' };
  }
  return response;
}