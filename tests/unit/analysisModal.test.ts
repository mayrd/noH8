import { describe, test, expect, vi } from 'vitest';
import {
  openAnalysisModal,
  buildCommentReportUrl,
} from '../../src/content/ui/analysisModal';
import { buildReportSnippet } from '../../src/content/ui/reportHelper';
import { analyzeCommentText } from '../../src/content/analysis/sentimentAnalyzer';
import type { CommentAnalysis } from '../../src/shared/types';
import { FakeEl, makeDoc, makeWindow } from './fakeDom';

/** Flush microtasks so async click handlers (clipboard → open) settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

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

  test('clicking the report button copies evidence, then opens the report url (L2)', async () => {
    const doc = makeDoc();
    const win = makeWindow();
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    const analysis = analyzeCommentText(COMMENT);

    // Record every element the modal creates so the anchor path is observable.
    const created: FakeEl[] = [];
    const baseCreate = doc.createElement.bind(doc);
    doc.createElement = (tag: string) => {
      const el = baseCreate(tag) as unknown as FakeEl;
      created.push(el);
      return el as unknown as ReturnType<typeof baseCreate>;
    };

    openAnalysisModal({
      doc,
      comment: COMMENT,
      analysis,
      windowRef: win,
      clipboard: { writeText },
    });

    const overlay = (doc.body as unknown as FakeEl).findByData('noh8ModalOverlay')!;
    const reportButton = overlay.findByData('noh8Report')!;
    expect(reportButton).not.toBeNull();
    reportButton.click();
    await flush();

    // Evidence snippet copied first...
    expect(writeText).toHaveBeenCalledWith(buildReportSnippet(COMMENT, analysis));
    // ...then the platform report URL opens via a popup-safe new-tab anchor.
    const anchor = created.find((el) => el.tag === 'a');
    expect(anchor).toBeDefined();
    expect(anchor!.attrs['href']).toBe(buildCommentReportUrl(COMMENT));
    expect(anchor!.attrs['target']).toBe('_blank');
    expect(anchor!.attrs['rel']).toBe('noopener noreferrer');
    expect(anchor!.removed).toBe(true);
    expect(win.open).not.toHaveBeenCalled();
    // Status feedback is surfaced in the modal.
    expect(overlay.joinedText()).toContain('Evidence copied to clipboard.');
  });

  test('still opens the report url and shows a failure note when the clipboard is unavailable (L2)', async () => {
    const doc = makeDoc();
    const win = makeWindow();
    const analysis = analyzeCommentText(COMMENT);
    const created: FakeEl[] = [];
    const baseCreate = doc.createElement.bind(doc);
    doc.createElement = (tag: string) => {
      const el = baseCreate(tag) as unknown as FakeEl;
      created.push(el);
      return el as unknown as ReturnType<typeof baseCreate>;
    };

    openAnalysisModal({ doc, comment: COMMENT, analysis, windowRef: win });

    const overlay = (doc.body as unknown as FakeEl).findByData('noh8ModalOverlay')!;
    overlay.findByData('noh8Report')!.click();
    await flush();

    const anchor = created.find((el) => el.tag === 'a');
    expect(anchor).toBeDefined();
    expect(anchor!.attrs['href']).toBe(buildCommentReportUrl(COMMENT));
    expect(overlay.joinedText()).toContain('Could not copy evidence.');
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
