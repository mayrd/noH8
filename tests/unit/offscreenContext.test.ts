import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { CommentAnalysis } from '../../src/shared/types';

/**
 * M14 — offscreen context-mode inference. The model runs twice for replies
 * (reply-alone, then reply-with-truncated-parent) and the two analyses are
 * merged conservatively via `mergeCommentAnalyses`. These tests mock the
 * Transformers pipeline, the model store, and calibration to drive
 * `analyzeComment` / `handleOffscreenRequest` end-to-end at the unit level.
 */

// Deterministic fake toxicity classifier: flags 'toxic' when the input text
// contains a marker token.
const classifierCalls: string[] = [];
function makeClassifier(marker: string) {
  return async (input: string): Promise<unknown> => {
    classifierCalls.push(input);
    const toxic = input.includes(marker);
    return [
      { label: 'toxic', score: toxic ? 0.95 : 0.05 },
      { label: 'neutral', score: toxic ? 0.05 : 0.95 },
    ];
  };
}

vi.mock('../../src/settings/modelStore', () => ({
  modelStore: {
    getState: () => ({ selectedModelId: 'test-model' }),
  },
}));

vi.mock('../../src/offscreen/transformersLoader', () => ({
  loadTransformers: vi.fn(async () => ({
    pipeline: vi.fn(async () => makeClassifier('INSULT_MARKER')),
  })),
}));

vi.mock('../../src/offscreen/calibration', () => ({
  calibrateAnalysis: vi.fn(async (analysis: CommentAnalysis) => analysis),
}));

vi.mock('../../src/offscreen/modelCatalog', () => ({
  findModelDescriptor: vi.fn(() => ({
    id: 'test-model',
    task: 'text-classification',
    mode: 'toxicity',
    hateLabels: ['toxic'],
  })),
  commentAnalysisFromOutputs: vi.fn(
    (opts: { modelId: string; commentId: string; outputs: { label: string; score: number }[] }) => {
      const toxic = opts.outputs.find((o) => o.label === 'toxic');
      const score = toxic ? toxic.score : 0;
      return {
        commentId: opts.commentId,
        sentiment: { score: 1 - 2 * score, label: score > 0.5 ? 'negative' : 'neutral' },
        isHateSpeech: score >= 0.7,
        hateSpeechScore: score,
        issues: score >= 0.7
          ? [{ id: 'hate_speech', label: 'Hate speech', description: 'd' }]
          : [],
      } as CommentAnalysis;
    }
  ),
}));

import { analyzeComment, handleOffscreenRequest } from '../../src/offscreen/inference';
import { MSG } from '../../src/shared/messages';

describe('offscreen inference (thread context, M14)', () => {
  beforeEach(() => {
    classifierCalls.length = 0;
  });

  test('top-level comments run the model once (no context path)', async () => {
    const result = await analyzeComment('a clean reply', 'c1');
    expect(classifierCalls).toHaveLength(1);
    expect(result.isHateSpeech).toBe(false);
  });

  test('replies run the model twice: reply-alone then reply-with-context', async () => {
    await analyzeComment('a clean reply', 'c1', 'parent turn text');
    expect(classifierCalls).toHaveLength(2);
    expect(classifierCalls[0]).toBe('a clean reply');
    expect(classifierCalls[1]).toBe('parent turn text a clean reply');
  });

  test('flags a reply whose abuse only emerges with the parent context', async () => {
    // Reply alone is clean; prepending the parent (which carries the marker)
    // pushes the model over the threshold — the merge must flag.
    const result = await analyzeComment('nice point indeed', 'c1', 'INSULT_MARKER in parent');
    expect(result.isHateSpeech).toBe(true);
    expect(result.hateSpeechScore).toBeGreaterThanOrEqual(0.7);
  });

  test('keeps a reply clean when neither run crosses the threshold', async () => {
    const result = await analyzeComment('totally fine words', 'c1', 'also fine parent');
    expect(result.isHateSpeech).toBe(false);
    expect(result.hateSpeechScore).toBeLessThan(0.7);
  });

  test('truncates oversized parent text before the context run', async () => {
    const hugeParent = 'x'.repeat(2000) + ' INSULT_MARKER';
    await analyzeComment('a reply', 'c1', hugeParent);
    expect(classifierCalls).toHaveLength(2);
    expect(classifierCalls[1].length).toBeLessThanOrEqual(500 + ' a reply'.length);
  });

  test('handleOffscreenRequest forwards parentText from the analyze message', async () => {
    const response = await handleOffscreenRequest({
      type: MSG.ANALYZE,
      text: 'a reply',
      commentId: 'c1',
      parentText: 'parent with INSULT_MARKER',
    });
    expect(response.ok).toBe(true);
    expect(classifierCalls).toHaveLength(2);
    expect(classifierCalls[1]).toContain('INSULT_MARKER');
  });
});
