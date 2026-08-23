import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderDraftReviewButton } from '../../src/content/ui/draftReview';
import { analyzeCommentText } from '../../src/content/analysis/sentimentAnalyzer';
import { FakeEl, makeDoc, makeWindow } from './fakeDom';

const DRAFT_TEXT = 'this is a draft comment';
const ANALYZE = vi.fn().mockResolvedValue(
  analyzeCommentText({ id: 'draft-1', text: DRAFT_TEXT })
);

beforeEach(() => {
  vi.clearAllMocks();
  ANALYZE.mockResolvedValue(
    analyzeCommentText({ id: 'draft-1', text: DRAFT_TEXT })
  );
});

describe('renderDraftReviewButton', () => {
  test('places a rainbow button as the next sibling of the textarea', () => {
    const doc = makeDoc();
    const parent = new FakeEl('div');
    const textarea = new FakeEl('textarea');
    textarea.value = DRAFT_TEXT;
    parent.appendChild(textarea);

    renderDraftReviewButton({
      textarea: textarea as never,
      platform: 'instagram',
      doc,
      analyze: ANALYZE,
    });

    const rainbow = parent.findByData('noh8DraftRainbow');
    expect(rainbow).not.toBeNull();
    expect(rainbow!.tag).toBe('button');
    expect(rainbow!.textContent).toBe('🌈');
    expect(rainbow!.parentNode).toBe(parent);
    const siblings = parent.children;
    expect(siblings[siblings.indexOf(textarea) + 1]).toBe(rainbow);
  });

  test('does not render a second button when called twice on the same textarea', () => {
    const doc = makeDoc();
    const parent = new FakeEl('div');
    const textarea = new FakeEl('textarea');
    parent.appendChild(textarea);

    renderDraftReviewButton({ textarea: textarea as never, platform: 'tiktok', doc, analyze: ANALYZE });
    renderDraftReviewButton({ textarea: textarea as never, platform: 'tiktok', doc, analyze: ANALYZE });

    const buttons = parent
      .findButtons()
      .filter((b) => b.dataset['noh8DraftRainbow'] === 'true');
    expect(buttons).toHaveLength(1);
  });

  test('skips textareas that already have a draft button', () => {
    const doc = makeDoc();
    const parent = new FakeEl('div');
    const textarea = new FakeEl('textarea');
    parent.appendChild(textarea);

    textarea.dataset['noh8DraftButton'] = 'true';
    renderDraftReviewButton({ textarea: textarea as never, platform: 'youtube', doc, analyze: ANALYZE });

    const buttons = parent
      .findButtons()
      .filter((b) => b.dataset['noh8DraftRainbow'] === 'true');
    expect(buttons).toHaveLength(0);
  });

  test('clicking the button reads the textarea value, analyzes it and opens a modal', async () => {
    const doc = makeDoc();
    const win = makeWindow();
    const parent = new FakeEl('div');
    const textarea = new FakeEl('textarea');
    textarea.value = 'you are awful and stupid';
    parent.appendChild(textarea);

    renderDraftReviewButton({
      textarea: textarea as never,
      platform: 'facebook',
      doc,
      windowRef: win,
      analyze: ANALYZE,
    });

    const button = parent.findByData('noh8DraftRainbow')!;
    button.click();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ANALYZE).toHaveBeenCalledWith({
      id: expect.stringContaining('facebook'),
      text: 'you are awful and stupid',
    });
    expect((doc.body as unknown as FakeEl).findByData('noh8ModalOverlay')).not.toBeNull();
  });

  test('reads contenteditable textContent when value is unset', async () => {
    const doc = makeDoc();
    const parent = new FakeEl('div');
    const editor = new FakeEl('div');
    editor.textContent = 'hateful contenteditable text';
    parent.appendChild(editor);

    renderDraftReviewButton({
      textarea: editor as never,
      platform: 'youtube',
      doc,
      analyze: ANALYZE,
    });

    const button = parent.findByData('noh8DraftRainbow')!;
    button.click();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ANALYZE).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'hateful contenteditable text' })
    );
  });

  test('falls back to appending the button to the textarea when it has no parent', () => {
    const doc = makeDoc();
    const textarea = new FakeEl('textarea');
    textarea.value = 'orphan textarea';

    renderDraftReviewButton({
      textarea: textarea as never,
      platform: 'instagram',
      doc,
      analyze: ANALYZE,
    });

    const rainbow = textarea.findByData('noh8DraftRainbow');
    expect(rainbow).not.toBeNull();
  });
});
