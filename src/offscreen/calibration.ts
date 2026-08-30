import type { CommentAnalysis } from '../shared/types';

/**
 * Local feedback calibration (M13 — privacy-preserving learning).
 *
 * False-positive dismissals persisted by the sidepanel (M9, under
 * `noh8_dismissed_flags`) are a signal the on-device pipeline can learn from:
 * each dismissal nudges the flag threshold up by a small bounded step, so
 * borderline comments stop being flagged. The adjustment converges instead of
 * running away and is fully resettable — resetting clears only the derived
 * thresholds, never the user's dismissal history.
 *
 * This module is deliberately pure/local: it touches `chrome.storage.local`
 * only, and never any network, ML, or messaging surface (guarded by
 * `tests/unit/calibration.test.ts`).
 */

/** Storage key for the derived (learned) per-model flag thresholds. */
export const CALIBRATION_STORAGE_KEY = 'noh8_calibration';
/** Storage key of the M9 false-positive dismissal keys this calibration derives from. */
export const DISMISSED_STORAGE_KEY = 'noh8_dismissed_flags';
/** Threshold bump per dismissed false positive. */
export const CALIBRATION_STEP = 0.02;
/** Upper bound on the total bump, so calibration converges. */
export const MAX_CALIBRATION_ADJUSTMENT = 0.2;
/** Fallback flag threshold for model ids without a known default. */
export const DEFAULT_THRESHOLD = 0.5;

/** Minimal structural subset of `CommentAnalysis` used by the calibration seam. */
export type CommentAnalysisLike = Pick<
  CommentAnalysis,
  'commentId' | 'sentiment' | 'isHateSpeech' | 'hateSpeechScore' | 'issues'
>;

/** Storage seam injected into `createCalibration` so the logic stays testable. */
/**
 * Pure derivation: per-model calibrated thresholds from a dismissal count.
 * Monotonic in the count, `CALIBRATION_STEP` per dismissal, clamped at
 * `MAX_CALIBRATION_ADJUSTMENT` above the default so it converges.
 */
export function deriveCalibratedThresholds(
  dismissalCount: number,
  defaults: Record<string, number>
): Record<string, number> {
  const bump = Math.min(
    Math.max(dismissalCount, 0) * CALIBRATION_STEP,
    MAX_CALIBRATION_ADJUSTMENT
  );
  const thresholds: Record<string, number> = {};
  for (const [modelId, base] of Object.entries(defaults)) {
    thresholds[modelId] = base + bump;
  }
  return thresholds;
}

/**
 * Pure ingestion downgrade: a flagged analysis whose raw score is below the
 * calibrated threshold becomes `not_flagged`. The raw `hateSpeechScore` is
 * preserved so the analysis modal can still show the model's confidence.
 */
export function applyCalibration(
  analysis: CommentAnalysisLike,
  calibratedThreshold: number
): CommentAnalysisLike {
  if (!analysis.isHateSpeech || analysis.hateSpeechScore >= calibratedThreshold) {
    return analysis;
  }
  return {
    ...analysis,
    isHateSpeech: false,
    issues: analysis.issues.filter((issue) => issue.id !== 'hate_speech'),
  };
}

/** Persisted reset marker: the dismissal count at the most recent reset. */
export interface CalibrationRecord {
  baselineDismissalCount: number;
}

/** Storage seam injected into `createCalibration` so the logic stays testable. */
export interface CalibrationStorage {
  /** Number of persisted false-positive dismissal keys. */
  readDismissalCount(): Promise<number>;
  /** The reset baseline, or `null` when the user has never reset learning. */
  readBaseline(): Promise<number | null>;
  /** Persist the reset baseline. */
  writeBaseline(baselineDismissalCount: number): Promise<void>;
}

/** Result of `createCalibration` — the seam the offscreen pipeline consumes. */
export interface Calibration {
  /** Effective flag threshold for a model id (calibrated, or its default). */
  thresholdFor(modelId: string): Promise<number>;
  /** Reset learning: dismissals after this point start counting afresh. */
  reset(): Promise<void>;
}

/**
 * Build a calibration controller over an injected storage seam. Pure
 * dependency injection — no direct `chrome.*` access here.
 */
export function createCalibration(options: {
  storage?: CalibrationStorage;
  defaults?: Record<string, number>;
}): Calibration {
  const storage = options.storage ?? chromeCalibrationStorage();
  const defaults = options.defaults ?? {};

  return {
    thresholdFor: async (modelId: string): Promise<number> => {
      const [count, baseline] = await Promise.all([
        storage.readDismissalCount(),
        storage.readBaseline(),
      ]);
      const learned = Math.max(0, count - Math.max(baseline ?? 0, 0));
      const base = defaults[modelId] ?? DEFAULT_THRESHOLD;
      return base + Math.min(learned * CALIBRATION_STEP, MAX_CALIBRATION_ADJUSTMENT);
    },

    reset: async (): Promise<void> => {
      const count = await storage.readDismissalCount();
      await storage.writeBaseline(Math.max(count, 0));
    },
  };
}
function hasLocalStorage(): boolean {
  return Boolean(typeof chrome !== 'undefined' && chrome.storage?.local);
}

function readLocal(key: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (res) => resolve(res ?? {}));
  });
}

/** `chrome.storage.local`-backed adapter for `CalibrationStorage`. */
export function chromeCalibrationStorage(): CalibrationStorage {
  return {
    readDismissalCount: async (): Promise<number> => {
      if (!hasLocalStorage()) return 0;
      const result = await readLocal(DISMISSED_STORAGE_KEY);
      const data = result[DISMISSED_STORAGE_KEY];
      return Array.isArray(data) ? data.length : 0;
    },
    readBaseline: async (): Promise<number | null> => {
      if (!hasLocalStorage()) return null;
      const result = await readLocal(CALIBRATION_STORAGE_KEY);
      const data = result[CALIBRATION_STORAGE_KEY] as Partial<CalibrationRecord> | undefined;
      return typeof data?.baselineDismissalCount === 'number'
        ? data.baselineDismissalCount
        : null;
    },
    writeBaseline: async (baselineDismissalCount: number): Promise<void> => {
      if (!hasLocalStorage()) return;
      const record: CalibrationRecord = { baselineDismissalCount };
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [CALIBRATION_STORAGE_KEY]: record }, () => resolve());
      });
    },
  };
}

/**
 * Result-ingestion seam used by the offscreen pipeline: applies the calibrated
 * threshold for `modelId` to a freshly produced analysis. Safe when
 * `chrome.storage` is unavailable (never downgrades, never throws).
 */
export async function calibrateAnalysis(
  analysis: CommentAnalysisLike,
  modelId: string
): Promise<CommentAnalysisLike> {
  if (!hasLocalStorage()) return analysis;
  try {
    const calibration = createCalibration({ defaults: {} });
    const threshold = await calibration.thresholdFor(modelId);
    return applyCalibration(analysis, threshold);
  } catch {
    return analysis;
  }
}

/**
 * Settings-page entry point: clear the learned thresholds only. The user's
 * dismissal history (`noh8_dismissed_flags`) is intentionally preserved.
 */
export async function resetLearnedCalibration(): Promise<void> {
  await createCalibration({ defaults: {} }).reset();
}

