import { describe, test, expect } from 'vitest';
import type { CommentAnalysis } from '../../src/shared/types';
import {
  MAX_PARENT_CONTEXT_LENGTH,
  truncateParentContext,
  mergeCommentAnalyses,
} from '../../src/content/analysis/threadContext';

/**
 * M14 — Reply-thread context analysis: the shared, DOM-agnostic context-merge
 * seam. These are pure functions consumed by BOTH the on-device model path
 * (offscreen/inference.ts) and the heuristic fallback (sentimentAnalyzer.ts),
 * so the conservative "flag if either crosses the threshold" merge semantics
 * are defined once and covered here.
 */

function analysis(opts: Partial<CommentAnalysis> = {}): CommentAnalysis {
  return {
    commentId: 'c1',
    sentiment: { score: 0, label: 'neutral' },
    isHateSpeech: false,
    hateSpeechScore: 0,
    issues: [],
    ...opts,
  };
}

describe('threadContext', () => {
  describe('truncateParentContext', () => {
    test('leaves text shorter than the limit unchanged', () => {
      const short = 'a'.repeat(100);
      expect(truncateParentContext(short)).toBe(short);
    });

    test('truncates text that exceeds the limit to at most MAX_PARENT_CONTEXT_LENGTH chars', () => {
      const long = 'a'.repeat(MAX_PARENT_CONTEXT_LENGTH + 500);
      const truncated = truncateParentContext(long);
      expect(truncated.length).toBeLessThanOrEqual(MAX_PARENT_CONTEXT_LENGTH);
      expect(truncated.length).toBe(MAX_PARENT_CONTEXT_LENGTH);
    });

    test('keeps the leading portion of long context (most relevant for prepending)', () => {
      const long = 'START' + 'x'.repeat(MAX_PARENT_CONTEXT_LENGTH + 100) + 'END';
      const truncated = truncateParentContext(long);
      expect(truncated.startsWith('START')).toBe(true);
      expect(truncated).not.toContain('END');
    });

    test('returns empty string for empty input without throwing', () => {
      expect(truncateParentContext('')).toBe('');
    });
  });

  describe('mergeCommentAnalyses (conservative flag-either merge)', () => {
    test('returns not-flagged when both inputs are clean (max score, union issues)', () => {
      const a = analysis({ hateSpeechScore: 0.1, issues: [] });
      const b = analysis({ hateSpeechScore: 0.3, issues: [] });
      const merged = mergeCommentAnalyses(a, b);
      expect(merged.isHateSpeech).toBe(false);
      expect(merged.hateSpeechScore).toBe(0.3); // max
    });

    test('flags when reply-only is hateful (flag if either crosses threshold)', () => {
      const a = analysis({ isHateSpeech: true, hateSpeechScore: 0.9, issues: [{ id: 'hate_speech', label: 'H', description: 'd' }] });
      const b = analysis({ isHateSpeech: false, hateSpeechScore: 0 });
      const merged = mergeCommentAnalyses(a, b);
      expect(merged.isHateSpeech).toBe(true);
      expect(merged.hateSpeechScore).toBe(0.9);
    });

    test('flags when reply-with-context is hateful but reply-only is clean', () => {
      const a = analysis({ isHateSpeech: false, hateSpeechScore: 0.1 });
      const b = analysis({ isHateSpeech: true, hateSpeechScore: 0.85 });
      const merged = mergeCommentAnalyses(a, b);
      expect(merged.isHateSpeech).toBe(true);
      expect(merged.hateSpeechScore).toBe(0.85);
    });

    test('flags when both are hateful and keeps the max score', () => {
      const a = analysis({ isHateSpeech: true, hateSpeechScore: 0.9 });
      const b = analysis({ isHateSpeech: true, hateSpeechScore: 0.6 });
      const merged = mergeCommentAnalyses(a, b);
      expect(merged.isHateSpeech).toBe(true);
      expect(merged.hateSpeechScore).toBe(0.9);
    });

    test('unions issues by id (deduplicated), reply-only first', () => {
      const a = analysis({ issues: [{ id: 'hate_speech', label: 'H', description: 'd' }] });
      const b = analysis({ issues: [{ id: 'hate_speech', label: 'H', description: 'd' }, { id: 'profanity', label: 'P', description: 'p' }] });
      const merged = mergeCommentAnalyses(a, b);
      expect(merged.issues.map((i) => i.id)).toEqual(['hate_speech', 'profanity']);
    });

    test('prefers the more negative sentiment score from the pair', () => {
      const moreNegative = analysis({ sentiment: { score: -0.6, label: 'negative' } });
      const morePositive = analysis({ sentiment: { score: 0.4, label: 'positive' } });
      expect(mergeCommentAnalyses(morePositive, moreNegative).sentiment.score).toBe(-0.6);
      expect(mergeCommentAnalyses(moreNegative, morePositive).sentiment.score).toBe(-0.6);
    });

    test('carries the commentId from the reply-only analysis', () => {
      const a = analysis({ commentId: 'reply' });
      const b = analysis({ commentId: 'context' });
      expect(mergeCommentAnalyses(a, b).commentId).toBe('reply');
    });
  });
});
