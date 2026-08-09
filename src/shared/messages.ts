/**
 * Messaging protocol between the content scripts / settings UI, the background
 * service worker and the offscreen document hosting the Transformers.js
 * pipeline.
 *
 * Flow (background SW relays reliably after ensuring the offscreen doc exists):
 *   content/settings --sendMessage--> service worker --sendMessage(relayed)--> offscreen
 *
 * The offscreen document only replies to messages flagged `relayed: true` so it
 * never double-processes the original broadcast that the content script sent.
 */

export const MSG = {
  ANALYZE: 'noh8:analyze',
  DOWNLOAD: 'noh8:downloadModel',
  DELETE: 'noh8:deleteModel',
  REFRESH: 'noh8:refreshModel',
} as const;

export type NoH8MessageType = (typeof MSG)[keyof typeof MSG];

export interface AnalyzeRequest {
  type: typeof MSG.ANALYZE;
  text: string;
}

export type ModelActionType =
  | typeof MSG.DOWNLOAD
  | typeof MSG.DELETE
  | typeof MSG.REFRESH;

export interface ModelCommandRequest {
  type: ModelActionType;
  modelId: string;
}

/** Any message the client can send towards the offscreen pipeline. */
export type NoH8Request = ({ requestId: string } & (AnalyzeRequest | ModelCommandRequest)) & {
  /** Set by the service worker when relaying towards the offscreen doc. */
  relayed?: boolean;
};

export type NoH8Response<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };