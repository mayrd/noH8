import {
  MSG,
  type ModelActionType,
  type NoH8Request,
  type NoH8Response,
} from '../shared/messages';
import type { CommentAnalysis } from '../shared/types';

/**
 * Thin client used by content scripts and the settings UI to talk to the
 * offscreen Transformers.js pipeline. Messages travel through the background
 * service worker, which guarantees the offscreen document exists first.
 */

let requestCounter = 0;
function nextRequestId(): string {
  requestCounter += 1;
  return `noh8-${Date.now()}-${requestCounter}`;
}

function send<T>(request: NoH8Request): Promise<NoH8Response<T>> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      resolve({ ok: false, error: 'chrome.runtime unavailable' });
      return;
    }
    chrome.runtime.sendMessage(request, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message ?? 'runtime error' });
        return;
      }
      resolve(response as NoH8Response<T>);
    });
  });
}

/** Analyze a piece of text with the currently selected on-device model. */
export async function requestAnalyze(
  text: string,
  commentId?: string
): Promise<CommentAnalysis> {
  const response = await send<CommentAnalysis>({
    requestId: nextRequestId(),
    type: MSG.ANALYZE,
    text,
    commentId,
  });
      if (response.ok) {
    return response.data;
  }
  throw new Error((response as { ok: false; error: string }).error);
}

const ACTION_TO_TYPE: Record<'download' | 'delete' | 'refresh', ModelActionType> = {
  download: MSG.DOWNLOAD,
  delete: MSG.DELETE,
  refresh: MSG.REFRESH,
};

/** Send a model lifecycle command (download / refresh / delete) to the pipeline. */
export async function requestModelCommand(
  action: 'download' | 'delete' | 'refresh',
  modelId: string
): Promise<void> {
  const response = await send<null>({
    requestId: nextRequestId(),
    type: ACTION_TO_TYPE[action],
    modelId,
  });
      if (response.ok) {
    return;
  }
  throw new Error((response as { ok: false; error: string }).error);
}