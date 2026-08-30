import { describe, it, expect } from 'vitest';
import { exportFlagsToJson, flagsExportFileName } from '../../src/sidepanel/flagExport';
import type { FlaggedComment } from '../../src/sidepanel/flagStore';

function makeComment(overrides: Partial<FlaggedComment> = {}): FlaggedComment {
  return {
    id: '1',
    commentId: 'yt-123',
    platform: 'youtube',
    author: 'ToxicUser',
    text: 'Hateful text',
    url: 'https://www.youtube.com/watch?v=abc',
    timestamp: 1700000000000,
    sentiment: { score: -0.9, label: 'negative' },
    isHateSpeech: true,
    hateSpeechScore: 0.95,
    issues: [{ id: 'hate_speech', label: 'Hate Speech', description: 'Hate speech detected' }],
    ...overrides,
  };
}

describe('flagExport', () => {
  it('produces valid JSON containing all exported flag fields', () => {
    const comments = [
      makeComment(),
      makeComment({ id: '2', commentId: 'ig-456', platform: 'instagram' }),
    ];

    const parsed = JSON.parse(exportFlagsToJson(comments)) as {
      exportedAt: string;
      count: number;
      comments: Array<Record<string, unknown>>;
    };

    expect(parsed.count).toBe(2);
    expect(parsed.comments).toHaveLength(2);
    expect(parsed.comments[0]).toMatchObject({
      commentId: 'yt-123',
      platform: 'youtube',
      author: 'ToxicUser',
      text: 'Hateful text',
      hateSpeechScore: 0.95,
    });
    expect(typeof parsed.exportedAt).toBe('string');
  });

  it('sorts comments newest-first in the export regardless of input order', () => {
    const older = makeComment({ id: 'old', timestamp: 1000 });
    const newer = makeComment({ id: 'new', timestamp: 2000 });

    const parsed = JSON.parse(exportFlagsToJson([older, newer])) as {
      comments: Array<{ id: string }>;
    };

    expect(parsed.comments.map((c) => c.id)).toEqual(['new', 'old']);
  });

  it('exports an empty collection as a zero-count payload', () => {
    const parsed = JSON.parse(exportFlagsToJson([])) as { count: number; comments: unknown[] };
    expect(parsed.count).toBe(0);
    expect(parsed.comments).toHaveLength(0);
  });

  it('never includes internal element references in the export payload', () => {
    const raw = exportFlagsToJson([makeComment()]);
    expect(raw).not.toContain('elementRef');
  });

  it('derives a timestamped download filename', () => {
    expect(flagsExportFileName(new Date('2026-08-30T12:00:00Z'))).toBe(
      'noh8-flags-2026-08-30.json'
    );
  });
});