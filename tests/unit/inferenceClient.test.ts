import { describe, test, expect, vi } from 'vitest';

// Provide a default no-op runtime; requestAnalyze will throw only if the mock is
// configured to reject. We stub the client's sendMessage return path below.
global.chrome = { runtime: { sendMessage: vi.fn() } } as any;

import { inferComment } from '../../src/content/analysis/inferenceClient';
import { requestAnalyze } from '../../src/offscreen/client';

vi.mock('../../src/offscreen/client', () => ({
  requestAnalyze: vi.fn(),
}));

const mockedRequestAnalyze = requestAnalyze as unknown as ReturnType<typeof vi.fn>;

const COMMENT = { id: 'c1', text: 'this is a totally neutral comment' };

describe('inferenceClient', () => {
  test('returns the transformer result when the pipeline succeeds', async () => {
    const modelResult = {
      commentId: 'c1',
      sentiment: { score: 0.8, label: 'positive' as const },
      isHateSpeech: false,
      hateSpeechScore: 0,
      issues: [],
    };
    mockedRequestAnalyze.mockResolvedValueOnce(modelResult);

    await expect(inferComment(COMMENT)).resolves.toEqual(modelResult);
  });

  test('falls back to the heuristic analyser when the model fails', async () => {
    mockedRequestAnalyze.mockRejectedValueOnce(new Error('pipeline down'));

    const result = await inferComment(COMMENT);
    expect(result.commentId).toBe('c1');
    expect(result.isHateSpeech).toBe(false);
    // Deterministic heuristic output: neutral text => neutral, no issues.
    expect(result.sentiment.label).toBe('neutral');
    expect(result.issues).toHaveLength(0);
  });

    test('falls back to the heuristic analyser when no runtime exists', async () => {
    mockedRequestAnalyze.mockRejectedValueOnce(
      new Error('chrome.runtime unavailable')
    );
    const result = await inferComment(COMMENT);
    expect(result).toMatchObject({ commentId: 'c1', isHateSpeech: false });
  });
});

describe('inferenceClient (thread context, M14)', () => {
  test('forwards parentText to the offscreen pipeline for replies', async () => {
    const modelResult = {
      commentId: 'c1',
      sentiment: { score: 0, label: 'neutral' as const },
      isHateSpeech: false,
      hateSpeechScore: 0,
      issues: [],
    };
    mockedRequestAnalyze.mockResolvedValueOnce(modelResult);

    await inferComment({ id: 'c1', text: 'reply text', parentText: 'parent text' });

    expect(mockedRequestAnalyze).toHaveBeenCalledWith(
      'reply text',
      'c1',
      'parent text'
    );
  });

  test('omits parentText for top-level comments', async () => {
    mockedRequestAnalyze.mockResolvedValueOnce({
      commentId: 'c1',
      sentiment: { score: 0, label: 'neutral' as const },
      isHateSpeech: false,
      hateSpeechScore: 0,
      issues: [],
    });

    await inferComment({ id: 'c1', text: 'top-level' });
    expect(mockedRequestAnalyze).toHaveBeenCalledWith('top-level', 'c1', undefined);
  });

  test('heuristic fallback receives parentText for context-aware scoring', async () => {
    mockedRequestAnalyze.mockRejectedValueOnce(new Error('pipeline down'));

    // Reply alone is clean; the parent carries a hate word → context path flags.
    const result = await inferComment({
      id: 'c1',
      text: 'nice point indeed',
      parentText: 'racists are evil',
    });
    expect(result.isHateSpeech).toBe(true);
  });
});