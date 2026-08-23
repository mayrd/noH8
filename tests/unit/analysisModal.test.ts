import { describe, test, expect } from 'vitest';
import {
  openAnalysisModal,
  buildCommentReportUrl,
} from '../../src/content/ui/analysisModal';
import { analyzeCommentText } from '../../src/content/analysis/sentimentAnalyzer';
import type { CommentAnalysis } from '../../src/shared/types';
import { FakeEl, makeDoc, makeWindow } from './fakeDom';

const COMMENT = {
  id: 'instagram-abc123',
  platform: 'instagram' as const,
  author: 'tester_user',
  text: 'this is just awful and terrible',
};

describe('buildCommentReportUrl', () => {
  test('returns an instagram report url for the comment', () => {
    expect(buildCommentReportUrl(COMMENT)).toMatch(/^https:\/\/www\.instagram\.com\//);
  });
});

describe('openAnalysisModal', () => {
  test('shows sentiment scoring, hate speech status and detected issues', () => {
    const doc = makeDoc();
    const text = 'nazis like you should be exterminated';
    const analysis: CommentAnalysis = analyzeCommentText({ id: COMMENT.id, text });

    openAnalysisModal({ doc, comment: COMMENT, analysis });

    const overlay = (doc.body as unknown as FakeEl).findByData('noh8ModalOverlay')!;
    const fullText = overlay.joinedText();
    expect(fullText).toContain('Sentiment');
    expect(fullText).toContain('-1');
    expect(fullText).toContain('+1');
    expect(fullText).toContain('Hate speech');
    expect(fullText).toContain('Flagged');
    expect(fullText).toContain('targeting people based on identity');
  });

  test('clicking the report button opens the instagram report url', () => {
    const doc = makeDoc();
    const win = makeWindow();
    const analysis = analyzeCommentText(COMMENT);

    openAnalysisModal({ doc, comment: COMMENT, analysis, windowRef: win });

    const overlay = (doc.body as unknown as FakeEl).findByData('noh8ModalOverlay')!;
    const reportButton = overlay.findByData('noh8Report')!;
    expect(reportButton).not.toBeNull();
    reportButton.click();
    expect(win.open).toHaveBeenCalledWith(buildCommentReportUrl(COMMENT), '_blank');
  });

  test('clicking the close button removes the overlay', () => {
    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    openAnalysisModal({ doc, comment: COMMENT, analysis });

    const overlay = (doc.body as unknown as FakeEl).findByData('noh8ModalOverlay')!;
    overlay.findByData('noh8Close')!.click();
    expect(overlay.removed).toBe(true);
  });
});
