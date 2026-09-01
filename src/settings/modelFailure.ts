/**
 * M16 — download-failure classification.
 *
 * Pure, dependency-free classifier that maps an unknown download error into a
 * small, user-meaningful failure class. The class drives the retry affordance
 * and failure messaging in `ModelManager.tsx` so a failed model download is
 * diagnosable instead of surfacing as a silent heuristic fallback.
 *
 * Classification is message-derived and heuristic by design: Transformers.js /
 * fetch errors are not typed in the browser, so we match on well-known message
 * fragments and default to `unknown` (which still gets a retry button).
 */

export const MODEL_FAILURE_KINDS = ['network', 'corrupt', 'quota', 'unknown'] as const;

export type ModelFailureKind = (typeof MODEL_FAILURE_KINDS)[number];

const NETWORK_PATTERNS = [
  'network',
  'fetch failed',
  'failed to fetch',
  'timeout',
  'timed out',
  'offline',
  'disconnected',
  'err_name_not_resolved',
  'err_connection',
];

const CORRUPT_PATTERNS = [
  'corrupt',
  'invalid archive',
  'checksum',
  'unexpected end of data',
  'malformed',
  'failed to parse',
  'onnxruntime',
  'invalid protobuf',
];

const QUOTA_PATTERNS = ['quota', 'storage full', 'no space', 'exceeded the quota'];

function matches(message: string, patterns: string[]): boolean {
  const haystack = message.toLowerCase();
  return patterns.some((p) => haystack.includes(p));
}

/** Extract a comparable message from any thrown value. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

/** Classify a model-download failure into a user-meaningful kind. */
export function classifyModelFailure(error: unknown): ModelFailureKind {
  const message = messageOf(error);
  if (!message) return 'unknown';
  if (matches(message, QUOTA_PATTERNS)) return 'quota';
  if (matches(message, CORRUPT_PATTERNS)) return 'corrupt';
  if (matches(message, NETWORK_PATTERNS)) return 'network';
  return 'unknown';
}
