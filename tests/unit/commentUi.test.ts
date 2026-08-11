import { describe, test, expect, vi } from 'vitest';
import {
  buildCommentReportUrl,
  renderCommentControls,
  openAnalysisModal,
  renderDraftReviewButton,
} from '../../src/content/ui/commentUi';
import { analyzeCommentText } from '../../src/content/analysis/sentimentAnalyzer';
import type { CommentAnalysis } from '../../src/shared/types';

// --- Structural DOM fakes (no jsdom required) ---

interface FakeElInit {
  tag: string;
}

class FakeEl {
    tag: string;
  children: FakeEl[] = [];
  handlers: Record<string, (event?: unknown) => void> = {};
  attrs: Record<string, string> = {};
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  textContent: string | null = null;
  value: string | null = null;
  removed = false;
  parent: FakeEl | null = null;

  /** Optional querySelector hook, set per-test when selector-based anchoring is exercised. */
  querySelector?: (selector: string) => FakeEl | null;

  /** Mirrors the DOM `parentNode` property. */
  get parentNode(): FakeEl | null {
    return this.parent;
  }

  /** Mirrors the DOM `nextSibling` property. */
  get nextSibling(): FakeEl | null {
    const siblings = this.parent?.children ?? [];
    const idx = siblings.indexOf(this);
    return idx >= 0 && idx + 1 < siblings.length ? siblings[idx + 1] : null;
  }

  /** Mirrors `Node.insertBefore`: inserts `node` before `ref` (or appends when null). */
  insertBefore(node: FakeEl, ref: FakeEl | null): void {
    node.parent = this;
    if (ref === null) {
      this.children.push(node);
    } else {
      const idx = this.children.indexOf(ref);
      if (idx === -1) {
        this.children.push(node);
      } else {
        this.children.splice(idx, 0, node);
      }
    }
  }

  constructor(tag: string, _init?: FakeElInit) {
    this.tag = tag;
  }

  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }

  appendChild(node: FakeEl): void {
    node.parent = this;
    this.children.push(node);
  }

  addEventListener(type: string, listener: (event?: unknown) => void): void {
    this.handlers[type] = listener;
  }

  remove(): void {
    this.removed = true;
  }

  click(event?: unknown): void {
    this.handlers['click']?.(event);
  }

  private walk(fn: (el: FakeEl) => void): void {
    fn(this);
    for (const child of this.children) child.walk(fn);
  }

  findByData(marker: string): FakeEl | null {
    let found: FakeEl | null = null;
    this.walk((el) => {
      if (!found && el.dataset[marker] === 'true') found = el;
    });
    return found;
  }

  findButtons(): FakeEl[] {
    const buttons: FakeEl[] = [];
    this.walk((el) => {
      if (el.tag === 'button') buttons.push(el);
    });
    return buttons;
  }

  joinedText(): string {
    let out = this.textContent ?? '';
    for (const child of this.children) out += child.joinedText();
    return out;
  }
}

function makeDoc() {
  return {
    body: new FakeEl('body'),
    createElement: (tag: string) => new FakeEl(tag),
  };
}

function makeWindow() {
  return { open: vi.fn() };
}

function makeCommentContainer(extraControlsPrev = false) {
  const container = new FakeEl('li');
  container.dataset['noh8RainbowButton'] = extraControlsPrev ? 'true' : '';
  return container;
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

describe('renderCommentControls', () => {
  test('appends a rainbow button to the comment container', () => {
    const container = makeCommentContainer();
    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    renderCommentControls({ container, comment: COMMENT, analysis, doc });

    const button = container.findByData('noh8Rainbow');
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe('🌈');
    expect(container.children.some((child) => child.attrs['data-noh8-rainbow'] === 'true')).toBe(true);
  });

  test('does not render a second button when called twice', () => {
    const container = makeCommentContainer();
    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    renderCommentControls({ container, comment: COMMENT, analysis, doc });
    renderCommentControls({ container, comment: COMMENT, analysis, doc });

    const buttons = container.findButtons().filter(
      (button) => button.dataset['noh8Rainbow'] === 'true'
    );
    expect(buttons).toHaveLength(1);
  });

  test('clicking the rainbow button opens an analysis modal', () => {
    const container = makeCommentContainer();
    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    renderCommentControls({ container, comment: COMMENT, analysis, doc, win: makeWindow() });

    const button = container.findByData('noh8Rainbow')!;
    expect(button).not.toBeNull();
    button.click();

    expect(doc.body.findByData('noh8ModalOverlay')).not.toBeNull();
  });
});

describe('renderCommentControls (Instagram heart-button placement)', () => {
  const HEART_SELECTOR = '[data-heart-button]';

  test('places the rainbow button beneath the heart button when a selector is provided', () => {
    // Comment container holds an actions row that holds the heart/like button — a
    // realistic slice of the Instagram comment DOM.
    const container = new FakeEl('li');
    const actionsRow = new FakeEl('div');
    const heartButton = new FakeEl('button');
    actionsRow.appendChild(heartButton);
    container.appendChild(actionsRow);
    container.querySelector = vi.fn((sel: string) =>
      sel === HEART_SELECTOR ? heartButton : null
    );

    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    renderCommentControls({
      container,
      comment: COMMENT,
      analysis,
      doc,
      heartButtonSelector: HEART_SELECTOR,
    });

    expect(container.querySelector).toHaveBeenCalledWith(HEART_SELECTOR);

    const rainbow = container.findByData('noh8Rainbow');
    expect(rainbow).not.toBeNull();

    // The rainbow button is anchored as the heart button's next sibling (under it)
    // within the SAME parent — not appended to the comment container.
    expect(rainbow!.parentNode).toBe(heartButton.parentNode);
    const siblings = heartButton.parentNode!.children;
    const heartIdx = siblings.indexOf(heartButton);
    const rainbowIdx = siblings.indexOf(rainbow!);
    expect(rainbowIdx).toBe(heartIdx + 1);
  });

  test('falls back to appending to the container when the heart button is absent', () => {
    const container = new FakeEl('li');
    const actionsRow = new FakeEl('div');
    container.appendChild(actionsRow);
    container.querySelector = vi.fn(() => null);

    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    renderCommentControls({
      container,
      comment: COMMENT,
      analysis,
      doc,
      heartButtonSelector: HEART_SELECTOR,
    });

    const rainbow = container.findByData('noh8Rainbow');
    expect(rainbow).not.toBeNull();
    expect(container.children.includes(rainbow!)).toBe(true);
  });

  test('remains idempotent when anchored under the heart button', () => {
    const container = new FakeEl('li');
    const heartButton = new FakeEl('button');
    container.appendChild(heartButton);
    container.querySelector = vi.fn((sel: string) =>
      sel === HEART_SELECTOR ? heartButton : null
    );

    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    renderCommentControls({
      container,
      comment: COMMENT,
      analysis,
      doc,
      heartButtonSelector: HEART_SELECTOR,
    });
    renderCommentControls({
      container,
      comment: COMMENT,
      analysis,
      doc,
      heartButtonSelector: HEART_SELECTOR,
    });

    const rainbowButtons = container
      .findButtons()
      .filter((b) => b.dataset['noh8Rainbow'] === 'true');
    expect(rainbowButtons).toHaveLength(1);
  });
});

describe('openAnalysisModal', () => {
  test('shows sentiment scoring, hate speech status and detected issues', () => {
    const doc = makeDoc();
    const text = 'nazis like you should be exterminated';
    const analysis: CommentAnalysis = analyzeCommentText({ id: COMMENT.id, text });

    openAnalysisModal({ doc, comment: COMMENT, analysis });

    const overlay = doc.body.findByData('noh8ModalOverlay')!;
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

    const overlay = doc.body.findByData('noh8ModalOverlay')!;
    const reportButton = overlay.findByData('noh8Report')!;
    expect(reportButton).not.toBeNull();
    reportButton.click();
    expect(win.open).toHaveBeenCalledWith(buildCommentReportUrl(COMMENT), '_blank');
  });

      test('clicking the close button removes the overlay', () => {
    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    openAnalysisModal({ doc, comment: COMMENT, analysis });

    const overlay = doc.body.findByData('noh8ModalOverlay')!;
    overlay.findByData('noh8Close')!.click();
    expect(overlay.removed).toBe(true);
  });
});

describe('renderDraftReviewButton', () => {
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

  test('places a rainbow button as the next sibling of the textarea', () => {
    const doc = makeDoc();
    const parent = new FakeEl('div');
    const textarea = new FakeEl('textarea');
    textarea.value = DRAFT_TEXT;
    parent.appendChild(textarea);

    renderDraftReviewButton({
      textarea,
      platform: 'instagram',
      doc,
      analyze: ANALYZE,
    });

    const rainbow = parent.findByData('noh8DraftRainbow');
    expect(rainbow).not.toBeNull();
    expect(rainbow!.tag).toBe('button');
    expect(rainbow!.textContent).toBe('🌈');
    expect(rainbow!.parentNode).toBe(parent);
    // Rainbow button is inserted immediately after the textarea.
    const siblings = parent.children;
    expect(siblings[siblings.indexOf(textarea) + 1]).toBe(rainbow);
  });

  test('does not render a second button when called twice on the same textarea', () => {
    const doc = makeDoc();
    const parent = new FakeEl('div');
    const textarea = new FakeEl('textarea');
    parent.appendChild(textarea);

    renderDraftReviewButton({ textarea, platform: 'tiktok', doc, analyze: ANALYZE });
    renderDraftReviewButton({ textarea, platform: 'tiktok', doc, analyze: ANALYZE });

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

    // Pre-mark the textarea as already processed (e.g. by a previous pass).
    textarea.dataset['noh8DraftButton'] = 'true';
    renderDraftReviewButton({ textarea, platform: 'youtube', doc, analyze: ANALYZE });

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
      textarea,
      platform: 'facebook',
      doc,
      windowRef: win,
      analyze: ANALYZE,
    });

    const button = parent.findByData('noh8DraftRainbow')!;
    button.click();

    // Flush the async analyze handler.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ANALYZE).toHaveBeenCalledWith({
      id: expect.stringContaining('facebook'),
      text: 'you are awful and stupid',
    });
    expect(doc.body.findByData('noh8ModalOverlay')).not.toBeNull();
  });

  test('reads contenteditable textContent when value is unset', async () => {
    const doc = makeDoc();
    const parent = new FakeEl('div');
    const editor = new FakeEl('div');
    editor.textContent = 'hateful contenteditable text';
    parent.appendChild(editor);

    renderDraftReviewButton({
      textarea: editor,
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
    // No parent — insertBefore/appendChild on parentNode won't be available.

    renderDraftReviewButton({
      textarea,
      platform: 'instagram',
      doc,
      analyze: ANALYZE,
    });

    // Button should still be created and attached to the textarea itself.
    const rainbow = textarea.findByData('noh8DraftRainbow');
    expect(rainbow).not.toBeNull();
  });
});