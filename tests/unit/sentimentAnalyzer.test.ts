import { describe, test, expect } from 'vitest';
import { analyzeCommentText } from '../../src/content/analysis/sentimentAnalyzer';

function analyze(text: string) {
  return analyzeCommentText({ id: 'c1', text });
}

function analyzeWithContext(text: string, parentText?: string) {
  return analyzeCommentText({ id: 'c1', text, parentText });
}

describe('sentimentAnalyzer', () => {
  test('scores clearly positive comments above zero and labels them positive', () => {
    const result = analyze('This is truly great and amazing, I love it!');
    expect(result.sentiment.score).toBeGreaterThan(0);
    expect(result.sentiment.label).toBe('positive');
    expect(result.isHateSpeech).toBe(false);
  });

  test('scores clearly negative comments below zero and labels them negative', () => {
    const result = analyze('This is awful and terrible, really bad and disappointing.');
    expect(result.sentiment.score).toBeLessThan(0);
    expect(result.sentiment.label).toBe('negative');
    expect(result.isHateSpeech).toBe(false);
  });

  test('reports a negative_tone issue for negative non-hate comments', () => {
    const result = analyze('This is awful and terrible.');
    expect(result.issues.map((issue) => issue.id)).toContain('negative_tone');
  });

  test('detects hate speech and adds a hate_speech issue', () => {
    const result = analyze('nazis like you should be exterminated');
    expect(result.isHateSpeech).toBe(true);
    expect(result.hateSpeechScore).toBeGreaterThan(0);
    expect(result.issues.map((issue) => issue.id)).toContain('hate_speech');
  });

  test('detects profanity issues separately from hate speech', () => {
    const result = analyze('what a damn disaster, so shit.');
    expect(result.isHateSpeech).toBe(false);
    expect(result.issues.map((issue) => issue.id)).toContain('profanity');
  });

  test('returns a neutral, unflagged result for balanced or empty text', () => {
    const balanced = analyze('the cat sat on the mat and everyone watched the sun');
    expect(balanced.sentiment.label).toBe('neutral');
    expect(balanced.isHateSpeech).toBe(false);

    const empty = analyze('   ');
    expect(empty.sentiment.score).toBe(0);
    expect(empty.sentiment.label).toBe('neutral');
    expect(empty.isHateSpeech).toBe(false);
    expect(empty.issues).toHaveLength(0);
  });

    test('keeps the hate speech score clamped to [0, 1]', () => {
    const result = analyze('nazis and racists and homophobes and nazis');
    expect(result.hateSpeechScore).toBeGreaterThanOrEqual(0);
    expect(result.hateSpeechScore).toBeLessThanOrEqual(1);
  });
});

describe('sentimentAnalyzer (thread context, M14)', () => {
  test('with no parentText behaves identically to the base analyser (back-compat)', () => {
    const base = analyze('nazis should be exterminated');
    const withCtx = analyzeWithContext('nazis should be exterminated');
    expect(withCtx).toEqual(base);
    expect(withCtx.isHateSpeech).toBe(true);
  });

  test('plain abuse with no parent is still flagged (back-compat)', () => {
    const result = analyze('nazis should be exterminated');
    expect(result.isHateSpeech).toBe(true);
    expect(result.issues.map((i) => i.id)).toContain('hate_speech');
  });

  test('quoted denial suppresses a false-positive flag (reply repeats the hate term but denies it)', () => {
    // Parent quotes a hate insult ("nazi"); reply denies it ("no, ... lies").
    // The base analyser flag the reply on its own ("nazi"); the denial rule
    // should suppress that false positive.
    const result = analyzeWithContext('no, nazi lies', 'you are a nazi');
    expect(result.isHateSpeech).toBe(false);
    expect(result.hateSpeechScore).toBe(0);
    expect(result.issues.map((i) => i.id)).not.toContain('hate_speech');
  });

  test('context merge flags agreement with a quoted hate parent (not a denial)', () => {
    // Parent has a hate word; reply agrees, no denial marker → combined text is abusive.
    const result = analyzeWithContext('yes i agree', 'racists are evil');
    expect(result.isHateSpeech).toBe(true);
    expect(result.issues.map((i) => i.id)).toContain('hate_speech');
  });

  test('context merge flags when reply-with-context crosses threshold but reply alone does not', () => {
    // Clean reply alone; parent brings the hate word; not a denial → merge flags.
    const result = analyzeWithContext('nice point indeed', 'racists are evil');
    expect(result.isHateSpeech).toBe(true);
  });

    test('does not suppress when the parent has no hate word (no denial pattern)', () => {
    const result = analyzeWithContext('not a big fan', 'nice weather today');
    expect(result.isHateSpeech).toBe(false);
  });
});