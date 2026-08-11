import { describe, test, expect, vi } from 'vitest';
import TikTokAdapter from '../../src/content/adapters/tiktokAdapter';
import { getMatchesForPlatform } from '../../src/content/platformConfig';

// --- Minimal DOM fakes (no jsdom required) ---

interface FakeElement {
  querySelectorAll: ReturnType<typeof vi.fn>;
  querySelector: ReturnType<typeof vi.fn>;
  getAttribute: ReturnType<typeof vi.fn>;
  setAttribute: ReturnType<typeof vi.fn>;
  appendChild: ReturnType<typeof vi.fn>;
  textContent: string | null;
  classList: { add: ReturnType<typeof vi.fn> };
}

function makeEl(overrides: Partial<FakeElement> = {}): FakeElement {
  return {
    querySelectorAll: vi.fn(() => []),
    querySelector: vi.fn(() => null),
    getAttribute: vi.fn(() => null),
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    textContent: null,
    classList: { add: vi.fn() },
    ...overrides,
  };
}

// TikTok comments are a <p> whose own textContent IS the comment body.
function makeCommentEl(
  text: string,
  author: string,
  { authorSelector }: { authorSelector: string }
): FakeElement {
  const anchor = makeEl({ textContent: author });
  return makeEl({
    textContent: text,
    querySelector: vi.fn((sel: string) => (sel === authorSelector ? anchor : null)),
  });
}

function makeDoc() {
  return { createElement: vi.fn(() => makeEl()) };
}

function makeMutationObserverCapturer() {
  let capturedCallback: (() => void) | null = null;
  let observedRoot: unknown = null;
  const Ctor = class {
    constructor(cb: () => void) {
      capturedCallback = cb;
    }
    observe(_root: unknown) {
      observedRoot = _root;
    }
    disconnect() {}
  };
  return { Ctor, getCallback: () => capturedCallback, getRoot: () => observedRoot };
}

const TIKTOK_MATCHES = getMatchesForPlatform('tiktok');

describe('TikTokAdapter', () => {
  test('identifies itself as the tiktok platform', () => {
    const adapter = new TikTokAdapter();
    expect(adapter.platformName).toBe('tiktok');
  });

    test('declares the tiktok domains it should parse in the browser', () => {
    const adapter = new TikTokAdapter();
    expect(adapter.hostPermissions).toEqual(TIKTOK_MATCHES);
    expect(adapter.hostPermissions).toContain('https://www.tiktok.com/*');
  });

  test('exposes a comment textarea selector for draft review', () => {
    expect(TikTokAdapter.commentTextareaSelector).toBeTruthy();
    expect(typeof TikTokAdapter.commentTextareaSelector).toBe('string');
    const adapter = new TikTokAdapter();
    expect(adapter.commentTextareaSelector).toBe(TikTokAdapter.commentTextareaSelector);
  });

  test('extractComments parses comment text, author and element refs from the DOM', () => {
    const commentEl = makeCommentEl('you are toxic', 'tester_user', {
      authorSelector: TikTokAdapter.authorSelector,
    });
    const root = { querySelectorAll: vi.fn(() => [commentEl]) };

    const adapter = new TikTokAdapter({ root: root as any });
    const comments = adapter.extractComments();

    expect(comments).toHaveLength(1);
    expect(comments[0].platform).toBe('tiktok');
    expect(comments[0].text).toBe('you are toxic');
    expect(comments[0].author).toBe('tester_user');
    expect(comments[0].elementRef).toBe(commentEl);
    expect(comments[0].id).toBeTruthy();
  });

  test('extractComments skips comment containers without any text', () => {
    const emptyEl = makeCommentEl('', 'tester_user', {
      authorSelector: TikTokAdapter.authorSelector,
    });
    const root = { querySelectorAll: vi.fn(() => [emptyEl]) };

    const adapter = new TikTokAdapter({ root: root as any });
    expect(adapter.extractComments()).toHaveLength(0);
  });

  test('injectWarning appends a banner element to the matching comment element', () => {
    const commentEl = makeCommentEl('hateful text', 'author_x', {
      authorSelector: TikTokAdapter.authorSelector,
    });
    const root = { querySelectorAll: vi.fn(() => [commentEl]) };
    const doc = makeDoc();

    const adapter = new TikTokAdapter({ root: root as any, document: doc as any });

    const comments = adapter.extractComments();
    const id = comments[0].id;

    adapter.injectWarning(id, {
      commentId: id,
      isHateSpeech: true,
      score: 0.92,
      label: 'toxic',
    });

    expect(doc.createElement).toHaveBeenCalledWith('div');
    expect(commentEl.appendChild).toHaveBeenCalledTimes(1);
    const banner = doc.createElement.mock.results[0].value;
    expect(banner.setAttribute).toHaveBeenCalledWith('data-noh8-warning', 'true');
  });

  test('injectWarning does nothing when the comment element is not known', () => {
    const doc = makeDoc();
    const adapter = new TikTokAdapter({ root: null as any, document: doc as any });
    adapter.injectWarning('missing-id', {
      commentId: 'missing-id',
      isHateSpeech: true,
      score: 1,
      label: 'toxic',
    });
    expect(doc.createElement).not.toHaveBeenCalled();
  });

  test('observe emits new comments on initial scan and on DOM mutations without double-reporting', () => {
    const { Ctor, getCallback } = makeMutationObserverCapturer();

    const itemA = makeCommentEl('first comment', 'alice', {
      authorSelector: TikTokAdapter.authorSelector,
    });
    const items = [itemA];
    const root = { querySelectorAll: vi.fn(() => items) };

    const adapter = new TikTokAdapter({ root: root as any, MutationObserver: Ctor as any });

    const calls: any[] = [];
    adapter.observe((comments) => calls.push(comments.map((c) => c.id)));

    expect(calls).toHaveLength(1);

    const itemB = makeCommentEl('second comment', 'bob', {
      authorSelector: TikTokAdapter.authorSelector,
    });
    items.push(itemB);
    getCallback()!();

    expect(calls).toHaveLength(2);
    expect(calls[1]).toHaveLength(1); // only the new comment, not the duplicate
    expect(calls[0][0]).not.toBe(calls[1][0]);
    expect(adapter.extractComments()).toHaveLength(2);
  });
});