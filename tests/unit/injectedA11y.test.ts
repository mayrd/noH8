import { describe, test, expect, vi } from 'vitest';
import {
  openAnalysisModal,
  buildCommentReportUrl,
} from '../../src/content/ui/analysisModal';
import { createRainbowButton } from '../../src/content/ui/commentUi';
import { renderDraftReviewButton } from '../../src/content/ui/draftReview';
import { injectRainbowMotionStyles } from '../../src/content/ui/motion';
import { analyzeCommentText } from '../../src/content/analysis/sentimentAnalyzer';
import { FakeEl, makeDoc, makeWindow } from './fakeDom';

/**
 * M15 — Accessibility of the injected (content-script) UI.
 *
 * Every interactive element needs ARIA semantics, the modal needs a keyboard
 * path (Escape closes, focus returns to the trigger), and the rainbow
 * animation must respect `prefers-reduced-motion`.
 */

const COMMENT = {
  id: 'instagram-abc123',
  platform: 'instagram' as const,
  author: 'tester_user',
  text: 'this is just awful and terrible',
};

function openWithTrigger(): { overlay: FakeEl; trigger: FakeEl } {
  const doc = makeDoc();
  const analysis = analyzeCommentText(COMMENT);
  const trigger = new FakeEl('button');
  const overlay = openAnalysisModal({
    doc,
    comment: COMMENT,
    analysis,
    trigger: trigger as never,
  }) as unknown as FakeEl;
  return { overlay, trigger };
}

describe('analysis modal a11y semantics', () => {
  test('the modal card is a dialog with aria-modal', () => {
    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);
    openAnalysisModal({ doc, comment: COMMENT, analysis });

    const overlay = (doc.body as unknown as FakeEl).findByData('noh8ModalOverlay')!;
    const card = overlay.findByData('noh8Modal')!;
    expect(card.attrs['role']).toBe('dialog');
    expect(card.attrs['aria-modal']).toBe('true');
    expect(card.attrs['aria-label']).toBeTruthy();
  });

  test('pressing Escape closes the modal', () => {
    const { overlay } = openWithTrigger();
    overlay.handlers['keydown']({ key: 'Escape' });
    expect(overlay.removed).toBe(true);
  });

  test('other keys do not close the modal', () => {
    const { overlay } = openWithTrigger();
    overlay.handlers['keydown']({ key: 'Tab' });
    expect(overlay.removed).toBe(false);
  });

  test('closing via Escape restores focus to the trigger', () => {
    const { overlay, trigger } = openWithTrigger();
    overlay.handlers['keydown']({ key: 'Escape' });
    expect(trigger.focused).toBe(true);
  });

  test('closing via the close button restores focus to the trigger', () => {
    const { overlay, trigger } = openWithTrigger();
    overlay.findByData('noh8Close')!.click();
    expect(overlay.removed).toBe(true);
    expect(trigger.focused).toBe(true);
  });
});

describe('rainbow button a11y', () => {
  test('is a real, keyboard-focusable button with an aria-label', () => {
    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);
    const button = createRainbowButton(doc, COMMENT, analysis) as unknown as FakeEl;

    expect(button.tag).toBe('button');
    expect(button.attrs['type']).toBe('button');
    expect(button.attrs['aria-label']).toContain(COMMENT.author);
  });

  test('the draft-review button is a labelled button too', () => {
    const doc = makeDoc();
    const composer = new FakeEl('div');
    const textarea = new FakeEl('textarea');
    composer.appendChild(textarea);
    renderDraftReviewButton({
      textarea: textarea as never,
      platform: 'instagram',
      doc,
      analyze: vi.fn(async () => analyzeCommentText(COMMENT)),
    });

    const button = textarea.nextSibling as unknown as FakeEl;
    expect(button.tag).toBe('button');
    expect(button.attrs['type']).toBe('button');
    expect(button.attrs['aria-label']).toContain('NoH8');
  });

  test('the flagged draft-review button exposes its warning state accessibly (L3)', async () => {
    const doc = makeDoc();
    const composer = new FakeEl('div');
    const textarea = new FakeEl('textarea');
    textarea.value = 'nazis like you should be exterminated';
    composer.appendChild(textarea);
    renderDraftReviewButton({
      textarea: textarea as never,
      platform: 'youtube',
      doc,
      analyze: vi.fn(async () => analyzeCommentText({ id: 'draft-x', text: textarea.value ?? '' })),
    });

    const button = textarea.nextSibling as unknown as FakeEl;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Screen-reader users learn the draft is flagged without opening the modal.
    expect(button.attrs['aria-pressed']).toBe('true');
  });
});

describe('prefers-reduced-motion handling', () => {
  test('injects a stylesheet that disables animation under reduced motion', () => {
    const doc = makeDoc();
    injectRainbowMotionStyles(doc);

    const style = (doc.body as unknown as FakeEl).children.find(
      (child) => child.tag === 'style'
    )!;
    expect(style.textContent).toContain('@keyframes');
    expect(style.textContent).toContain('prefers-reduced-motion');
    expect(style.textContent).toContain('animation: none');
  });

  test('is idempotent — a second call does not add another style element', () => {
    const doc = makeDoc();
    injectRainbowMotionStyles(doc);
    injectRainbowMotionStyles(doc);

    const styles = (doc.body as unknown as FakeEl).children.filter(
      (child) => child.tag === 'style'
    );
    expect(styles).toHaveLength(1);
  });

  test('rainbow buttons are tagged with the animated class', () => {
    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);
    const button = createRainbowButton(doc, COMMENT, analysis) as unknown as FakeEl;
    expect(button.attrs['class']).toContain('noh8-rainbow-animated');
  });
});
