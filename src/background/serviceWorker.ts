import { runExtensionSetup, handleBackgroundMessage } from './setup';
import { MSG, type NoH8MessageType, type NoH8Request } from '../shared/messages';

/**
 * NoH8 background service worker (Manifest V3).
 *
 * Responsibilities:
 *   - Run one-time setup when the extension is installed (create the offscreen
 *     document that hosts Transformers.js and seed default model settings).
 *   - Re-ensure the offscreen document is alive on browser startup.
 *   - Relay analysis / model commands from content scripts and the settings UI
 *     to the offscreen pipeline.
 */

const MESSAGE_TYPES = new Set<NoH8MessageType>([
  MSG.ANALYZE,
  MSG.DOWNLOAD,
  MSG.DELETE,
  MSG.REFRESH,
]);

chrome.runtime.onInstalled.addListener((details) => {
  console.info(`[NoH8] installed (reason: ${details.reason}) running setup`);
  void runExtensionSetup();
});

chrome.runtime.onStartup.addListener(() => {
  void runExtensionSetup();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message?.type as NoH8MessageType;
  if (!MESSAGE_TYPES.has(type)) return false;

  handleBackgroundMessage(message as NoH8Request)
    .then(sendResponse)
    .catch((error) =>
      sendResponse({ ok: false, error: String(error?.message ?? error) })
    );
  return true; // keep the channel open for the async response
});