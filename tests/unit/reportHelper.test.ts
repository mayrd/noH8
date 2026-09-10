import { describe, test, expect, vi } from 'vitest';
import {
  buildReportUrl,
  reportActionLabel,
  buildReportSnippet,
  copyReportSnippet,
  openReportAnchor,
  reportComment,
} from '../../src/content/ui/reportHelper';
import type { CommentData } from '../../src/shared/types';
import type { UiDocument } from '../../src/shared/uiTypes';
import { FakeEl } from './fakeDom';

function baseComment(platform: CommentData['platform']): CommentData {
  return { id: 'c1', platform, author: 'tester_user', text: 'some comment' };
}

const FLAGGED_ANALYSIS = { isHateSpeech: true, hateSpeechScore: 0.92 };

describe('reportHelper', () => {
  test('youtube resolves to a YouTube support url', () => {
    const url = buildReportUrl('youtube', baseComment('youtube'));
    expect(url).toBe('https://support.google.com/youtube/answer/2801973');
  });

  test('instagram resolves to the Instagram report gate', () => {
    expect(buildReportUrl('instagram', baseComment('instagram'))).toBe(
      'https://www.instagram.com/report/'
    );
  });

  test('facebook resolves to a Facebook report url', () => {
    const url = buildReportUrl('facebook', baseComment('facebook'));
    expect(url).toBe('https://www.facebook.com/help/contact/153231014864064');
  });

  test('tiktok resolves to a TikTok report url', () => {
    const url = buildReportUrl('tiktok', baseComment('tiktok'));
    expect(url).toBe('https://www.tiktok.com/legal/page/tiktok-policy');
  });

  test('each platform returns a distinct url', () => {
    const urls = new Set([
      buildReportUrl('youtube', baseComment('youtube')),
      buildReportUrl('instagram', baseComment('instagram')),
      buildReportUrl('facebook', baseComment('facebook')),
      buildReportUrl('tiktok', baseComment('tiktok')),
    ]);
    expect(urls.size).toBe(4);
  });

  test('reportActionLabel derives the button label from the platform', () => {
    expect(reportActionLabel('youtube')).toBe('Report on YouTube');
    expect(reportActionLabel('instagram')).toBe('Report on Instagram');
    expect(reportActionLabel('facebook')).toBe('Report on Facebook');
    expect(reportActionLabel('tiktok')).toBe('Report on TikTok');
  });

  test('buildReportUrl depends only on the persisted platform field (removed-comment handling)', () => {
    // L2: a comment whose DOM element is gone still resolves the URL from
    // `platform` alone — no element/DOM access may be involved.
    const comment: CommentData = { id: 'c1', platform: 'facebook', author: 'a', text: 't' };
    expect(buildReportUrl('facebook', comment)).toBe(
      buildReportUrl('facebook', { ...comment, id: 'another-id' })
    );
  });
});

// --- L2: evidence snippet -------------------------------------------------

describe('buildReportSnippet (L2)', () => {
  test('includes author, platform, score and comment text', () => {
    const snippet = buildReportSnippet(baseComment('youtube'), FLAGGED_ANALYSIS);
    expect(snippet).toContain('tester_user');
    expect(snippet).toContain('YouTube');
    expect(snippet).toContain('92%');
    expect(snippet).toContain('some comment');
  });

  test('marks a flagged comment as flagged', () => {
    expect(buildReportSnippet(baseComment('tiktok'), FLAGGED_ANALYSIS)).toContain('flagged');
  });

  test('marks a clean comment as not flagged', () => {
    const snippet = buildReportSnippet(baseComment('tiktok'), {
      isHateSpeech: false,
      hateSpeechScore: 0.1,
    });
    expect(snippet.toLowerCase()).toContain('not flagged');
  });
});

// --- L2: clipboard seam ----------------------------------------------------

describe('copyReportSnippet (L2)', () => {
  test('copies the snippet through the injected clipboard', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    await expect(copyReportSnippet('snippet text', { writeText })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('snippet text');
  });

  test('returns false when no clipboard seam is available', async () => {
    await expect(copyReportSnippet('snippet text', undefined)).resolves.toBe(false);
  });

  test('returns false when the clipboard write rejects', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error('denied'));
    await expect(copyReportSnippet('snippet text', { writeText })).resolves.toBe(false);
  });
});

// --- L2: report flow orchestration -----------------------------------------

describe('reportComment (L2)', () => {
  test('copies the evidence snippet before opening the report url', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    const openTab = vi.fn<(url: string) => void>();
    const result = await reportComment(baseComment('tiktok'), FLAGGED_ANALYSIS, {
      clipboard: { writeText },
      openTab,
    });

    expect(result.copied).toBe(true);
    expect(result.url).toBe(buildReportUrl('tiktok', baseComment('tiktok')));
    expect(writeText).toHaveBeenCalledWith(
      buildReportSnippet(baseComment('tiktok'), FLAGGED_ANALYSIS)
    );
    expect(openTab).toHaveBeenCalledWith(result.url);
  });

  test('still opens the report url when the clipboard copy fails', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error('denied'));
    const openTab = vi.fn<(url: string) => void>();
    const result = await reportComment(baseComment('youtube'), FLAGGED_ANALYSIS, {
      clipboard: { writeText },
      openTab,
    });

    expect(result.copied).toBe(false);
    expect(openTab).toHaveBeenCalledTimes(1);
    expect(openTab).toHaveBeenCalledWith(buildReportUrl('youtube', baseComment('youtube')));
  });

  test('opens via the injected doc anchor when no openTab override is given', async () => {
    const created: FakeEl[] = [];
    const body = new FakeEl('body');
    const doc = {
      body,
      createElement: (tag: string) => {
        const el = new FakeEl(tag);
        created.push(el);
        return el;
      },
    } as unknown as UiDocument;

    await reportComment(baseComment('instagram'), FLAGGED_ANALYSIS, { doc });

    const anchor = created.find((el) => el.tag === 'a');
    expect(anchor).toBeDefined();
    expect(anchor!.attrs['href']).toBe(buildReportUrl('instagram', baseComment('instagram')));
  });
});

// --- L2: anchor opener safety ------------------------------------------------

describe('openReportAnchor (L2)', () => {
  test('opens in a new tab with rel=noopener noreferrer and cleans up', () => {
    const created: FakeEl[] = [];
    const body = new FakeEl('body');
    const doc = {
      body,
      createElement: (tag: string) => {
        const el = new FakeEl(tag);
        created.push(el);
        return el;
      },
    } as unknown as UiDocument;

    openReportAnchor('https://example.com/report', doc);

    const anchor = created.find((el) => el.tag === 'a');
    expect(anchor).toBeDefined();
    expect(anchor!.attrs['target']).toBe('_blank');
    expect(anchor!.attrs['rel']).toBe('noopener noreferrer');
    expect(anchor!.attrs['href']).toBe('https://example.com/report');
    expect(anchor!.removed).toBe(true);
  });
});