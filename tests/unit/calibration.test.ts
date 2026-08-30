import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CALIBRATION_STORAGE_KEY,
  DISMISSED_STORAGE_KEY,
  CALIBRATION_STEP,
  MAX_CALIBRATION_ADJUSTMENT,
  deriveCalibratedThresholds,
  applyCalibration,
  createCalibration,
  calibrateAnalysis,
  resetLearnedCalibration,
  DEFAULT_THRESHOLD,
  type CommentAnalysisLike,
} from '../../src/offscreen/calibration';

/**
 * M13 — Local feedback calibration.
 *
 * Dismissed false positives (persisted by M9 under `noh8_dismissed_flags`)
 * are a signal the pipeline can learn from entirely on-device: each dismissal
 * nudges the flag threshold up by a small bounded step so borderline comments
 * stop being flagged, without any server round-trip.
 */

const DEFAULTS: Record<string, number> = {
  'toxic-bert': 0.5,
  'sst-2-english': 0.5,
};

function makeAnalysis(overrides: Partial<CommentAnalysisLike> = {}): CommentAnalysisLike {
  return {
    commentId: 'c1',
    sentiment: { score: -0.6, label: 'negative' },
    isHateSpeech: true,
    hateSpeechScore: 0.55,
    issues: [{ id: 'hate_speech', label: 'Hate speech', description: 'd' }],
    ...overrides,
  };
}

describe('deriveCalibratedThresholds (pure)', () => {
  it('returns the defaults when there are no dismissals', () => {
    expect(deriveCalibratedThresholds(0, DEFAULTS)).toEqual(DEFAULTS);
  });

  it('nudges the threshold up monotonically with the dismissal count', () => {
    const few = deriveCalibratedThresholds(1, DEFAULTS);
    const more = deriveCalibratedThresholds(3, DEFAULTS);
    const evenMore = deriveCalibratedThresholds(6, DEFAULTS);
    for (const modelId of Object.keys(DEFAULTS)) {
      expect(more[modelId]).toBeGreaterThan(few[modelId]);
      expect(evenMore[modelId]).toBeGreaterThan(more[modelId]);
    }
  });

  it('uses a small converging step per dismissal (+0.02)', () => {
    const one = deriveCalibratedThresholds(1, DEFAULTS);
    expect(one['toxic-bert']).toBeCloseTo(0.5 + CALIBRATION_STEP, 10);
    const five = deriveCalibratedThresholds(5, DEFAULTS);
    expect(five['toxic-bert']).toBeCloseTo(0.5 + 5 * CALIBRATION_STEP, 10);
  });

  it('clamps the adjustment at the maximum (+0.2) instead of running away', () => {
    const clamped = deriveCalibratedThresholds(10_000, DEFAULTS);
    for (const modelId of Object.keys(DEFAULTS)) {
      expect(clamped[modelId]).toBeCloseTo(0.5 + MAX_CALIBRATION_ADJUSTMENT, 10);
    }
  });
});

describe('applyCalibration (pure ingestion downgrade)', () => {
  it('downgrades a flagged analysis below the calibrated threshold to not_flagged', () => {
    const out = applyCalibration(makeAnalysis(), 0.6);
    expect(out.isHateSpeech).toBe(false);
    expect(out.issues).toHaveLength(0);
  });

  it('keeps the raw hateSpeechScore available for the modal after downgrading', () => {
    const out = applyCalibration(makeAnalysis({ hateSpeechScore: 0.55 }), 0.6);
    expect(out.hateSpeechScore).toBe(0.55);
  });

  it('leaves analyses at or above the calibrated threshold untouched', () => {
    const flagged = makeAnalysis({ hateSpeechScore: 0.7 });
    expect(applyCalibration(flagged, 0.6)).toEqual(flagged);
    const unflagged = makeAnalysis({ isHateSpeech: false, hateSpeechScore: 0.1, issues: [] });
    expect(applyCalibration(unflagged, 0.6)).toEqual(unflagged);
  });
});

function createMockChromeStorage(initialData: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initialData };
  return {
    storage: {
      local: {
        get: vi.fn(
          (key: string | string[] | null, callback?: (res: Record<string, unknown>) => void) => {
            let result: Record<string, unknown> = {};
            if (typeof key === 'string') result = { [key]: store[key] };
            else if (Array.isArray(key)) key.forEach((k) => { result[k] = store[k]; });
            else result = { ...store };
            if (callback) callback(result);
            return Promise.resolve(result);
          }
        ),
        set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
          Object.assign(store, items);
          if (callback) callback();
          return Promise.resolve();
        }),
        remove: vi.fn((key: string | string[], callback?: () => void) => {
          const keys = Array.isArray(key) ? key : [key];
          keys.forEach((k) => delete store[k]);
          if (callback) callback();
          return Promise.resolve();
        }),
      },
    },
    rawStore: store,
  };
}

describe('createCalibration (DI container over storage)', () => {
  let mockChrome: ReturnType<typeof createMockChromeStorage>;

  beforeEach(() => {
    mockChrome = createMockChromeStorage();
    (globalThis as { chrome?: unknown }).chrome = mockChrome;
  });

  it('falls back to the defaults when there are no dismissals', async () => {
    const calibration = createCalibration({ defaults: DEFAULTS });
    await expect(calibration.thresholdFor('toxic-bert')).resolves.toBe(0.5);
  });

  it('derives the threshold from the persisted dismissal count', async () => {
    mockChrome.rawStore[DISMISSED_STORAGE_KEY] = ['a::u', 'b::u', 'c::u'];
    const calibration = createCalibration({ defaults: DEFAULTS });
    await expect(calibration.thresholdFor('toxic-bert')).resolves.toBeCloseTo(
      0.5 + 3 * CALIBRATION_STEP,
      10
    );
  });

  it('reset() returns to the defaults while keeping the dismissal history', async () => {
    mockChrome.rawStore[DISMISSED_STORAGE_KEY] = ['a::u'];
    const calibration = createCalibration({ defaults: DEFAULTS });
    await calibration.reset();
    expect(mockChrome.rawStore[DISMISSED_STORAGE_KEY]).toEqual(['a::u']);
    await expect(calibration.thresholdFor('toxic-bert')).resolves.toBe(0.5);
    // The reset is recorded as a baseline against the dismissal history.
    expect(mockChrome.rawStore[CALIBRATION_STORAGE_KEY]).toEqual({ baselineDismissalCount: 1 });
  });

  it('only counts dismissals made after the last reset', async () => {
    mockChrome.rawStore[DISMISSED_STORAGE_KEY] = ['a::u', 'b::u', 'c::u', 'd::u'];
    const calibration = createCalibration({ defaults: DEFAULTS });
    await calibration.reset();
    // A fresh dismissal after the reset re-learns from that dismissal only.
    mockChrome.rawStore[DISMISSED_STORAGE_KEY] = [...(mockChrome.rawStore[DISMISSED_STORAGE_KEY] as string[]), 'e::u'];
    await expect(calibration.thresholdFor('toxic-bert')).resolves.toBeCloseTo(
      0.5 + CALIBRATION_STEP,
      10
    );
  });

  it('uses the shared default for unknown model ids', async () => {
    const calibration = createCalibration({ defaults: DEFAULTS });
    await expect(calibration.thresholdFor('not-in-catalog')).resolves.toBe(DEFAULT_THRESHOLD);
  });

  it('works without chrome.storage available (defaults, no crash)', async () => {
    (globalThis as { chrome?: unknown }).chrome = undefined;
    const calibration = createCalibration({ defaults: DEFAULTS });
    await expect(calibration.thresholdFor('toxic-bert')).resolves.toBe(0.5);
    await expect(calibration.reset()).resolves.toBeUndefined();
  });
});

describe('calibrateAnalysis (offscreen result-ingestion seam)', () => {
  let mockChrome: ReturnType<typeof createMockChromeStorage>;

  beforeEach(() => {
    mockChrome = createMockChromeStorage();
    (globalThis as { chrome?: unknown }).chrome = mockChrome;
  });

  it('downgrades a calibrated-below-threshold analysis during ingestion', async () => {
    // 5 dismissals → threshold 0.5 + 0.1 = 0.6; score 0.55 is now below it.
    mockChrome.rawStore[DISMISSED_STORAGE_KEY] = ['a::u', 'b::u', 'c::u', 'd::u', 'e::u'];
    const out = await calibrateAnalysis(makeAnalysis({ hateSpeechScore: 0.55 }), 'toxic-bert');
    expect(out.isHateSpeech).toBe(false);
    expect(out.hateSpeechScore).toBe(0.55);
  });

  it('keeps clearly hateful analyses flagged', async () => {
    mockChrome.rawStore[DISMISSED_STORAGE_KEY] = ['a::u'];
    const out = await calibrateAnalysis(makeAnalysis({ hateSpeechScore: 0.9 }), 'toxic-bert');
    expect(out.isHateSpeech).toBe(true);
  });

  it('works without chrome.storage available (no crash, no downgrade)', async () => {
    (globalThis as { chrome?: unknown }).chrome = undefined;
    const out = await calibrateAnalysis(makeAnalysis({ hateSpeechScore: 0.55 }), 'toxic-bert');
    expect(out.isHateSpeech).toBe(true);
  });
});

describe('resetLearnedCalibration (settings-page entry point)', () => {
  let mockChrome: ReturnType<typeof createMockChromeStorage>;

  beforeEach(() => {
    mockChrome = createMockChromeStorage({
      [DISMISSED_STORAGE_KEY]: ['a::u', 'b::u', 'c::u'],
    });
    (globalThis as { chrome?: unknown }).chrome = mockChrome;
  });

  it('restores default thresholds while preserving dismissal history', async () => {
    // Before the reset, learning is active.
    expect(mockChrome.rawStore[CALIBRATION_STORAGE_KEY]).toBeUndefined();
    await resetLearnedCalibration();
    expect(mockChrome.rawStore[DISMISSED_STORAGE_KEY]).toEqual(['a::u', 'b::u', 'c::u']);
    expect(mockChrome.rawStore[CALIBRATION_STORAGE_KEY]).toEqual({ baselineDismissalCount: 3 });
  });
});

describe('calibration module architecture guard (privacy)', () => {
  const source = readFileSync(join(__dirname, '../../src/offscreen/calibration.ts'), 'utf8');

  it('imports no network / ML modules — everything derives from local storage', () => {
    expect(source).not.toMatch(/from\s+['"][^'"]*transformers[^'"]*['"]/);
    expect(source).not.toMatch(/from\s+['"][^'"]*modelStore[^'"]*['"]/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\bXMLHttpRequest\b/);
    expect(source).not.toMatch(/\bWebSocket\b/);
  });
});
