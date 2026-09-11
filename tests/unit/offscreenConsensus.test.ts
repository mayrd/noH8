import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { CommentAnalysis } from '../../src/shared/types';

/**
 * M17 — offscreen multi-model consensus. When a downloaded secondary model is
 * configured, `analyzeComment` scores every input with both models (reusing
 * the M14 thread-context path per model) and flags only on agreement; a
 * failing secondary degrades to the primary result instead of blocking.
 */

// Mutable store state so tests can toggle the consensus configuration.
const storeState = {
  selectedModelId: 'model-a',
  secondaryModelId: 'model-b' as string | null,
  downloadedModels: ['model-a', 'model-b'] as string[],
};

vi.mock('../../src/settings/modelStore', () => ({
  modelStore: { getState: () => storeState },
}));


// One deterministic classifier per model id: each flags only its own marker.
// The 'model-broken' pipeline always throws to exercise secondary failure.
const classifierCalls: Array<{ model: string; input: string }> = [];
function classifierFor(model: string): (input: string) => Promise<unknown> {
  if (model === 'model-broken') {
    return async (): Promise<unknown> => {
      throw new Error('secondary unavailable');
    };
  }
  const marker = model === 'model-a' ? 'HATE_A' : 'HATE_B';
  return async (input: string): Promise<unknown> => {
    classifierCalls.push({ model, input });
    const toxic = input.includes(marker);
    return [
      { label: 'toxic', score: toxic ? 0.95 : 0.05 },
      { label: 'neutral', score: toxic ? 0.05 : 0.95 },
    ];
  };
}

vi.mock('../../src/offscreen/transformersLoader', () => ({
  loadTransformers: vi.fn(async () => ({
    pipeline: vi.fn(async (_task: string, hfModelId: string) => classifierFor(hfModelId)),
  })),
}));

vi.mock('../../src/offscreen/calibration', () => ({
  calibrateAnalysis: vi.fn(async (analysis: CommentAnalysis) => analysis),
}));

vi.mock('../../src/offscreen/modelCatalog', () => ({
  findModelDescriptor: vi.fn((id: string) => ({
    id,
    name: `Name of ${id}`,
    task: 'text-classification',
    modelId: id,
    mode: 'toxicity',
    hateLabels: ['toxic'],
  })),
  commentAnalysisFromOutputs: vi.fn(
    (opts: {
      modelId: string;
      commentId: string;
      outputs: { label: string; score: number }[];
    }) => {
      const toxic = opts.outputs.find((o) => o.label === 'toxic');
      const score = toxic ? toxic.score : 0;
      return {
        commentId: opts.commentId,
        sentiment: { score: 1 - 2 * score, label: score > 0.5 ? 'negative' : 'neutral' },
        isHateSpeech: score >= 0.7,
        hateSpeechScore: score,
        issues:
          score >= 0.7 ? [{ id: 'hate_speech', label: 'Hate speech', description: 'd' }] : [],
      } as CommentAnalysis;
    }
  ),
}));

import { analyzeComment } from '../../src/offscreen/inference';

describe('offscreen inference (multi-model consensus, M17)', () => {
  beforeEach(() => {
    classifierCalls.length = 0;
    storeState.selectedModelId = 'model-a';
    storeState.secondaryModelId = 'model-b';
    storeState.downloadedModels = ['model-a', 'model-b'];
  });

  test('scores top-level comments with both models and keeps both verdicts', async () => {
    const result = await analyzeComment('entirely ordinary words', 'c1');

    expect(classifierCalls).toHaveLength(2);
    expect(classifierCalls.map((call) => call.model).sort()).toEqual(['model-a', 'model-b']);
    expect(result.isHateSpeech).toBe(false);
    expect(result.perModel).toHaveLength(2);
    expect(result.perModel?.map((verdict) => verdict.modelId).sort()).toEqual([
      'model-a',
      'model-b',
    ]);
  });

  test('resolves the human-readable model name into the verdicts', async () => {
    const result = await analyzeComment('ordinary words', 'c1');

    expect(
      result.perModel?.find((verdict) => verdict.modelId === 'model-a')?.modelName
    ).toBe('Name of model-a');
  });

  test('flags only when both models agree', async () => {
    const result = await analyzeComment('HATE_A plus HATE_B together', 'c1');

    expect(result.isHateSpeech).toBe(true);
    expect(result.hateSpeechScore).toBe(0.95);
    expect(result.perModel?.every((verdict) => verdict.isHateSpeech)).toBe(true);
  });

  test('stays clean when only the primary model flags', async () => {
    const result = await analyzeComment('HATE_A alone here', 'c1');

    expect(result.isHateSpeech).toBe(false);
    expect(result.issues.map((issue) => issue.id)).not.toContain('hate_speech');
    expect(
      result.perModel?.find((verdict) => verdict.modelId === 'model-a')?.isHateSpeech
    ).toBe(true);
    expect(
      result.perModel?.find((verdict) => verdict.modelId === 'model-b')?.isHateSpeech
    ).toBe(false);
  });

  test('runs each model twice for replies (reply-alone + with-context)', async () => {
    await analyzeComment('a reply', 'c1', 'some parent turn');

    expect(classifierCalls).toHaveLength(4);
    for (const model of ['model-a', 'model-b']) {
      const inputs = classifierCalls
        .filter((call) => call.model === model)
        .map((call) => call.input);
      expect(inputs).toEqual(['a reply', 'some parent turn a reply']);
    }
  });

  test('uses the single-model path when the secondary is not downloaded', async () => {
    storeState.downloadedModels = ['model-a'];

    const result = await analyzeComment('ordinary words', 'c1');

    expect(classifierCalls).toHaveLength(1);
    expect(result.perModel).toBeUndefined();
  });

  test('uses the single-model path when the secondary equals the primary', async () => {
    storeState.secondaryModelId = 'model-a';

    const result = await analyzeComment('ordinary words', 'c1');

    expect(classifierCalls).toHaveLength(1);
    expect(result.perModel).toBeUndefined();
  });

  test('degrades to the primary result when the secondary pipeline fails', async () => {
    storeState.secondaryModelId = 'model-broken';
    storeState.downloadedModels = ['model-a', 'model-broken'];

    const result = await analyzeComment('HATE_A words here', 'c1');

    // The primary opinion is preserved instead of throwing or going silent.
    expect(result.isHateSpeech).toBe(true);
    expect(result.hateSpeechScore).toBe(0.95);
    expect(result.perModel).toBeUndefined();
  });
});
