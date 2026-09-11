import { describe, test, expect } from 'vitest';
import type { CommentAnalysis, DetectedIssue } from '../../src/shared/types';
import {
  mergeConsensus,
  resolveConsensusModelId,
  analysisModelKey,
  type ConsensusInput,
} from '../../src/content/analysis/consensus';

/**
 * M17 — multi-model consensus merge. When a secondary model is configured and
 * downloaded, a comment is flagged only if enough models agree (unanimous by
 * default); the merged result always keeps every model's individual verdict
 * so the analysis modal can show the per-model scores.
 */

/** Minimal analysis fixture; override only what the case needs. */
function analysis(overrides: Partial<CommentAnalysis> = {}): CommentAnalysis {
  return {
    commentId: 'c1',
    sentiment: { score: 0, label: 'neutral' },
    isHateSpeech: false,
    hateSpeechScore: 0,
    issues: [],
    ...overrides,
  };
}

function hateIssue(): DetectedIssue {
  return { id: 'hate_speech', label: 'Hate speech', description: 'd' };
}

function toneIssue(): DetectedIssue {
  return { id: 'negative_tone', label: 'Negative tone', description: 'd' };
}

function input(
  modelId: string,
  overrides: Partial<CommentAnalysis> = {},
  modelName?: string
): ConsensusInput {
  return { analysis: analysis(overrides), modelId, ...(modelName ? { modelName } : {}) };
}

describe('mergeConsensus (multi-model consensus, M17)', () => {
  test('flags when both models agree, keeping the weaker score and both verdicts', () => {
    const result = mergeConsensus([
      input('model-a', { isHateSpeech: true, hateSpeechScore: 0.9, issues: [hateIssue()] }, 'Model A'),
      input('model-b', { isHateSpeech: true, hateSpeechScore: 0.7, issues: [hateIssue()] }, 'Model B'),
    ]);

    expect(result.isHateSpeech).toBe(true);
    // Consensus confidence is the weakest member: both crossed the threshold,
    // so the surviving score stays consistent with the flag.
    expect(result.hateSpeechScore).toBe(0.7);
    expect(result.perModel).toHaveLength(2);
    expect(result.perModel?.[0]).toMatchObject({
      modelId: 'model-a',
      modelName: 'Model A',
      isHateSpeech: true,
      hateSpeechScore: 0.9,
    });
    expect(result.perModel?.[1]).toMatchObject({
      modelId: 'model-b',
      modelName: 'Model B',
      isHateSpeech: true,
      hateSpeechScore: 0.7,
    });
    // The shared hate_speech issue is deduplicated, not doubled.
    expect(result.issues.map((issue) => issue.id)).toEqual(['hate_speech']);
  });

  test('stays clean when only one model flags (disagreement vetoes the flag)', () => {
    const result = mergeConsensus([
      input('model-a', {
        isHateSpeech: true,
        hateSpeechScore: 0.9,
        issues: [hateIssue()],
        sentiment: { score: -0.8, label: 'negative' },
      }),
      input('model-b', {
        isHateSpeech: false,
        hateSpeechScore: 0.1,
        sentiment: { score: -0.1, label: 'neutral' },
      }),
    ]);

    expect(result.isHateSpeech).toBe(false);
    expect(result.hateSpeechScore).toBe(0.1);
    expect(result.issues.map((issue) => issue.id)).not.toContain('hate_speech');
    // Verdicts are still kept so the modal can show the disagreement.
    expect(result.perModel).toHaveLength(2);
    expect(result.perModel?.[0]?.isHateSpeech).toBe(true);
    expect(result.perModel?.[1]?.isHateSpeech).toBe(false);
  });

  test('keeps non-hate issues from either model on a disagreement', () => {
    const result = mergeConsensus([
      input('model-a', { issues: [toneIssue()] }),
      input('model-b', { issues: [] }),
    ]);

    expect(result.isHateSpeech).toBe(false);
    expect(result.issues.map((issue) => issue.id)).toEqual(['negative_tone']);
  });

  test('quorum: a 2-of-3 majority flags', () => {
    const result = mergeConsensus(
      [
        input('a', { isHateSpeech: true, hateSpeechScore: 0.9, issues: [hateIssue()] }),
        input('b', { isHateSpeech: true, hateSpeechScore: 0.8, issues: [hateIssue()] }),
        input('c', { isHateSpeech: false, hateSpeechScore: 0.1 }),
      ],
      2
    );

    expect(result.isHateSpeech).toBe(true);
    expect(result.perModel).toHaveLength(3);
  });

  test('quorum: a unanimous requirement vetoes a 2-of-3 split', () => {
    const result = mergeConsensus(
      [
        input('a', { isHateSpeech: true, hateSpeechScore: 0.9, issues: [hateIssue()] }),
        input('b', { isHateSpeech: true, hateSpeechScore: 0.8, issues: [hateIssue()] }),
        input('c', { isHateSpeech: false, hateSpeechScore: 0.1 }),
      ],
      3
    );

    expect(result.isHateSpeech).toBe(false);
    expect(result.issues.map((issue) => issue.id)).not.toContain('hate_speech');
  });

  test('prefers the less-negative sentiment reading', () => {
    const result = mergeConsensus([
      input('a', { sentiment: { score: -0.8, label: 'negative' } }),
      input('b', { sentiment: { score: -0.1, label: 'neutral' } }),
    ]);

    expect(result.sentiment.score).toBe(-0.1);
  });

  test('carries the first input comment id', () => {
    const second: ConsensusInput = {
      ...input('b'),
      analysis: analysis({ commentId: 'c2' }),
    };
    expect(mergeConsensus([input('a'), second]).commentId).toBe('c1');
  });

  test('throws on an empty input list', () => {
    expect(() => mergeConsensus([])).toThrow();
  });
});

describe('resolveConsensusModelId (M17)', () => {
  test('returns null when no secondary model is configured', () => {
    expect(
      resolveConsensusModelId({ primaryModelId: 'a', secondaryModelId: null, downloadedModels: ['a'] })
    ).toBeNull();
    expect(
      resolveConsensusModelId({
        primaryModelId: 'a',
        secondaryModelId: undefined,
        downloadedModels: ['a'],
      })
    ).toBeNull();
  });

  test('returns null when the secondary equals the primary', () => {
    expect(
      resolveConsensusModelId({ primaryModelId: 'a', secondaryModelId: 'a', downloadedModels: ['a'] })
    ).toBeNull();
  });

  test('returns null when the secondary is not downloaded', () => {
    expect(
      resolveConsensusModelId({ primaryModelId: 'a', secondaryModelId: 'b', downloadedModels: ['a'] })
    ).toBeNull();
  });

  test('returns null when the download state is unknown', () => {
    expect(resolveConsensusModelId({ primaryModelId: 'a', secondaryModelId: 'b' })).toBeNull();
  });

  test('returns the secondary id when both models are ready', () => {
    expect(
      resolveConsensusModelId({
        primaryModelId: 'a',
        secondaryModelId: 'b',
        downloadedModels: ['a', 'b'],
      })
    ).toBe('b');
  });
});

describe('analysisModelKey (M17)', () => {
  test('keys on the primary model alone when consensus is inactive', () => {
    expect(
      analysisModelKey({ selectedModelId: 'a', secondaryModelId: null, downloadedModels: ['a'] })
    ).toBe('a');
  });

  test('keys on the model pair when consensus is active', () => {
    expect(
      analysisModelKey({ selectedModelId: 'a', secondaryModelId: 'b', downloadedModels: ['a', 'b'] })
    ).toBe('a+b');
  });

  test('falls back to the primary key when the secondary is not downloaded', () => {
    expect(
      analysisModelKey({ selectedModelId: 'a', secondaryModelId: 'b', downloadedModels: ['a'] })
    ).toBe('a');
  });
});
