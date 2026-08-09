import { handleOffscreenRequest } from './inference';
import { initModelStore } from '../settings/modelStore';
import type { NoH8Request, NoH8Response } from '../shared/messages';

/**
 * Offscreen document entry point.
 *
 * A headless page that hosts the Transformers.js pipeline. The service worker
 * creates this document on install and relays analyse/model messages to it.
 * It only processes messages that the service worker flags with `relayed: true`
 * to avoid double-handling the original broadcast the content script sent.
 */
void initModelStore();

chrome.runtime.onMessage.addListener((message: NoH8Request, _sender, sendResponse) => {
  if (!message?.relayed) return false;

  handleOffscreenRequest(message)
    .then((result) => sendResponse(result as NoH8Response))
    .catch((error) =>
      sendResponse({ ok: false, error: String(error?.message ?? error) } as NoH8Response)
    );
  return true; // async response
});

console.info('[NoH8] offscreen document ready for on-device inference.');