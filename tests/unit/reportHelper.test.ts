import { describe, test, expect } from 'vitest';
import {
  buildReportUrl,
  reportActionLabel,
} from '../../src/content/ui/reportHelper';
import type { CommentData } from '../../src/shared/types';

function baseComment(platform: CommentData['platform']): CommentData {
  return { id: 'c1', platform, author: 'tester_user', text: 'some comment' };
}

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
});