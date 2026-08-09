import { describe, test, expect, vi } from 'vitest';
import {
  buildCommentReportUrl,
  renderCommentControls,
  openAnalysisModal,
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
  removed = false;
  parent: FakeEl | null = null;

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