import { describe, test, expect } from 'vitest';
import { createRainbowButton, renderCommentControls, updateRainbowAnalysis } from '../../src/content/ui/commentUi';
import { FakeEl, makeDoc } from './fakeDom';
import type { CommentAnalysis } from '../../src/shared/types';

const COMMENT = {
  id: 'youtube-abc123',
  platform: 'youtube' as const,
  author: 'tester_user',
  text: 'hello world',
};

function analysisFor(label: 'positive' | 'neutral' | 'negative', overrides: Partial<CommentAnalysis> = {}): CommentAnalysis {
  return {
    commentId: COMMENT.id,
    sentiment: { score: label === 'positive' ? 0.8 : label === 'negative' ? -0.8 : 0, label },
    isHateSpeech: false,
    hateSpeechScore: 0,
    issues: [],
    ...overrides,
  };
}

describe('rainbow sentiment outline (RED)', () => {
  test('negative sentiment gets a red outline', () => {
    const doc = makeDoc();
    const button = createRainbowButton(doc, COMMENT, analysisFor('negative')) as unknown as FakeEl;
    expect(
      button.style['outline'] ?? button.style['boxShadow'] ?? button.style['border'] ?? ''
    ).toMatch(/ef4444|red|255,\s*0,\s*0/i);
    expect(button.attrs['data-noh8-sentiment'] ?? button.dataset['noh8Sentiment']).toBe('negative');
  });

  test('positive sentiment gets a green outline', () => {
    const doc = makeDoc();
    const button = createRainbowButton(doc, COMMENT, analysisFor('positive')) as unknown as FakeEl;
    expect(
      button.style['outline'] ?? button.style['boxShadow'] ?? button.style['border'] ?? ''
    ).toMatch(/22c55e|green|0,\s*128,\s*0/i);
    expect(button.attrs['data-noh8-sentiment'] ?? button.dataset['noh8Sentiment']).toBe('positive');
  });

  test('neutral sentiment gets no colored outline', () => {
    const doc = makeDoc();
    const button = createRainbowButton(doc, COMMENT, analysisFor('neutral')) as unknown as FakeEl;
    const outline = `${button.style['outline'] ?? ''} ${button.style['borderColor'] ?? ''}`;
    expect(outline).not.toMatch(/ef4444|22c55e/i);
  });

  test('updateRainbowAnalysis refreshes the outline when async inference lands', () => {
    const doc = makeDoc();
    const container = new FakeEl('ytd-comment-renderer');
    const holder = { current: analysisFor('neutral') };
    renderCommentControls({
      container: container as never,
      comment: COMMENT,
      analysis: holder as never,
      doc,
    });
    const button = container.findByData('noh8Rainbow')!;
    expect(button).not.toBeNull();
    updateRainbowAnalysis(button as never, analysisFor('negative'));
    const btn = button as unknown as FakeEl;
    expect(
      `${btn.style['outline'] ?? ''} ${btn.style['boxShadow'] ?? ''} ${btn.attrs['data-noh8-sentiment'] ?? ''} ${btn.dataset['noh8Sentiment'] ?? ''}`
    ).toMatch(/ef4444|negative/i);
  });
});
