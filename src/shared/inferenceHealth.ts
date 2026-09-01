/**
 * M16 — inference-health seam.
 *
 * The offscreen document records whether its last model inference succeeded or
 * fell back to the built-in heuristic analyser. The sidepanel reads the record
 * (via `chrome.storage.local` + `onChanged`, both local-only — never synced)
 * and shows a "heuristic fallback" badge so the accuracy drop is visible
 * instead of silent.
 *
 * Kept as a small standalone module so it can be unit-tested without the
 * Transformers.js pipeline and mocked cleanly in component tests.
 */

export interface InferenceHealth {
  /** True when the most recent analysis used the heuristic fallback. */
  fallbackActive: boolean;
  /** Catalog model id that was attempted (null if unknown). */
  modelId: string | null;
  /** Epoch milliseconds of the recording. */
  updatedAt: number;
}

export const INFERENCE_HEALTH_KEY = 'noh8_inference_health';

type StorageLike = {
  get: (key: string, cb: (items: Record<string, unknown>) => void) => void;
  set: (items: Record<string, unknown>, cb?: () => void) => void;
};

function localStorage(): StorageLike | null {
  const chromeRef = (globalThis as { chrome?: unknown }).chrome as
    | { storage?: { local?: StorageLike } }
    | undefined;
  return chromeRef?.storage?.local ?? null;
}

function onChanged(): {
  addListener: (cb: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => void;
  removeListener: (cb: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => void;
} | null {
  const chromeRef = (globalThis as { chrome?: unknown }).chrome as
    | { storage?: { onChanged?: unknown } }
    | undefined;
  const candidate = chromeRef?.storage?.onChanged as
    | {
        addListener: (cb: (c: Record<string, { newValue?: unknown }>, a: string) => void) => void;
        removeListener: (cb: (c: Record<string, { newValue?: unknown }>, a: string) => void) => void;
      }
    | undefined;
  return candidate ?? null;
}

/** Parse an unknown stored value into an `InferenceHealth`, or null. */
function parseHealth(raw: unknown): InferenceHealth | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Partial<InferenceHealth>;
  if (typeof candidate.fallbackActive !== 'boolean') return null;
  return {
    fallbackActive: candidate.fallbackActive,
    modelId: typeof candidate.modelId === 'string' ? candidate.modelId : null,
    updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : 0,
  };
}

/** Record the latest inference outcome to `chrome.storage.local` (never sync). */
export function recordInferenceHealth(health: InferenceHealth): void {
  const storage = localStorage();
  if (!storage) return;
  storage.set({ [INFERENCE_HEALTH_KEY]: health }, () => {});
}

/** Read the latest recorded inference outcome, or null when none exists. */
export function getInferenceHealth(): Promise<InferenceHealth | null> {
  return new Promise((resolve) => {
    const storage = localStorage();
    if (!storage) {
      resolve(null);
      return;
    }
    storage.get(INFERENCE_HEALTH_KEY, (items) => {
      resolve(parseHealth(items?.[INFERENCE_HEALTH_KEY]));
    });
  });
}

/**
 * Subscribe to inference-health changes. The callback fires immediately for the
 * current value when a change arrives; returns an unsubscribe function.
 */
export function subscribeInferenceHealth(
  callback: (health: InferenceHealth | null) => void
): () => void {
  const events = onChanged();
  if (!events) return () => {};
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string): void => {
    if (area !== 'local') return;
    const change = changes[INFERENCE_HEALTH_KEY];
    if (!change) return;
    callback(parseHealth(change.newValue));
  };
  events.addListener(listener);
  return () => events.removeListener(listener);
}
