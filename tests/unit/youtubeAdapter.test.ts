import { describe, test, expect, vi } from 'vitest';
import YouTubeAdapter from '../../src/content/adapters/youtubeAdapter';
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

function makeCommentEl(
  text: string,
  author: string,
  { textSelector }: { textSelector: string }
): FakeElement {
  const textSpan = makeEl({ textContent: text });
  const anchor = makeEl({ textContent: author });
  return makeEl({
    textContent: '',
    querySelectorAll: vi.fn((sel: string) => (sel === textSelector ? [textSpan] : [])),
    querySelector: vi.fn(() => anchor),
  });
}

function makeDoc() {
  return { createElement: vi.fn(() => makeEl()) };
}

function makeMutationObserverCapturer() {
  let capturedCallback: (() => void) | null = null;
  let observedRoot: unknown = null;
  let observeConfig: unknown = null;
  const Ctor = class {
    constructor(cb: () => void) {
      capturedCallback = cb;
    }
    observe(_root: unknown, _config: unknown) {
      observedRoot = _root;
      observeConfig = _config;
    }
    disconnect() {}
  };
  return { Ctor, getCallback: () => capturedCallback, getRoot: () => observedRoot, getConfig: () => observeConfig };
}

const YOUTUBE_MATCHES = getMatchesForPlatform('youtube');

describe('YouTubeAdapter', () => {
  test('identifies itself as the youtube platform', () => {
    const adapter = new YouTubeAdapter();
    expect(adapter.platformName).toBe('youtube');
  });

    test('declares the youtube domains it should parse in the browser', () => {
    const adapter = new YouTubeAdapter();
    expect(adapter.hostPermissions).toEqual(YOUTUBE_MATCHES);
    expect(adapter.hostPermissions).toContain('https://www.youtube.com/*');
  });

  test('exposes a comment textarea selector for draft review', () => {
    expect(YouTubeAdapter.commentTextareaSelector).toBeTruthy();
    expect(typeof YouTubeAdapter.commentTextareaSelector).toBe('string');
    const adapter = new YouTubeAdapter();
    expect(adapter.commentTextareaSelector).toBe(YouTubeAdapter.commentTextareaSelector);
  });

  test('extractComments parses comment text, author and element refs from the DOM', () => {
    const commentEl = makeCommentEl('you are toxic', 'tester_user', {
      textSelector: YouTubeAdapter.commentTextSelector,
    });
    const root = { querySelectorAll: vi.fn(() => [commentEl]) };

    const adapter = new YouTubeAdapter({ root: root as any });
    const comments = adapter.extractComments();

    expect(comments).toHaveLength(1);
    expect(comments[0].platform).toBe('youtube');
    expect(comments[0].text).toBe('you are toxic');
    expect(comments[0].author).toBe('tester_user');
    expect(comments[0].elementRef).toBe(commentEl);
    expect(comments[0].id).toBeTruthy();
  });

  test('extractComments skips comment containers without any text', () => {
    const emptyEl = makeCommentEl('', 'tester_user', {
      textSelector: YouTubeAdapter.commentTextSelector,
    });
    const root = { querySelectorAll: vi.fn(() => [emptyEl]) };

    const adapter = new YouTubeAdapter({ root: root as any });
    expect(adapter.extractComments()).toHaveLength(0);
  });

  test('injectWarning appends a banner element to the matching comment element', () => {
    const commentEl = makeCommentEl('hateful text', 'author_x', {
      textSelector: YouTubeAdapter.commentTextSelector,
    });
    const root = { querySelectorAll: vi.fn(() => [commentEl]) };
    const doc = makeDoc();

    const adapter = new YouTubeAdapter({ root: root as any, document: doc as any });

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
    const adapter = new YouTubeAdapter({ root: null as any, document: doc as any });
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
      textSelector: YouTubeAdapter.commentTextSelector,
    });
    const items = [itemA];
    const root = { querySelectorAll: vi.fn(() => items) };

    const adapter = new YouTubeAdapter({ root: root as any, MutationObserver: Ctor as any });

    const calls: any[] = [];
    adapter.observe((comments) => calls.push(comments.map((c) => c.id)));

    expect(calls).toHaveLength(1);

    const itemB = makeCommentEl('second comment', 'bob', {
      textSelector: YouTubeAdapter.commentTextSelector,
    });
    items.push(itemB);
    getCallback()!();

    expect(calls).toHaveLength(2);
    expect(calls[1]).toHaveLength(1); // only the new comment, not the duplicate
    expect(calls[0][0]).not.toBe(calls[1][0]);
    expect(adapter.extractComments()).toHaveLength(2);
  });
});

// --- L3: composer observation (draft-review coverage) ---

describe('YouTubeAdapter composer observation (L3)', () => {
  function makeComposerRoot(composers: unknown[]): { querySelectorAll: ReturnType<typeof vi.fn> } {
    // Route comment selectors to [] and the composer selector to the fake set.
    return {
      querySelectorAll: vi.fn((sel: string) =>
        sel === YouTubeAdapter.commentTextareaSelector ? (composers as never[]) : []
      ),
    };
  }

  function makeCapturer(): {
    Ctor: new (cb: () => void) => { observe(r: unknown, c: unknown): void; disconnect(): void };
    getCallback: () => (() => void) | null;
  } {
    let captured: (() => void) | null = null;
    const Ctor = class {
      constructor(cb: () => void) {
        captured = cb;
      }
      observe(_root: unknown, _config: unknown): void {}
      disconnect(): void {}
    };
    return { Ctor, getCallback: () => captured };
  }

  test('observe reports composers on the initial scan', () => {
    const { Ctor } = makeCapturer();
    const composer = { tagName: 'TEXTAREA' };
    const adapter = new YouTubeAdapter({
      root: makeComposerRoot([composer]) as never,
      MutationObserver: Ctor as never,
    });

    const seen: unknown[][] = [];
    adapter.observe(() => {}, (composers) => seen.push(composers));

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual([composer]);
  });

  test('observe reports only new composers on later scans (SPA re-render dedup)', () => {
    const { Ctor, getCallback } = makeCapturer();
    const composers: unknown[] = [{ tagName: 'TEXTAREA' }];
    const adapter = new YouTubeAdapter({
      root: makeComposerRoot(composers) as never,
      MutationObserver: Ctor as never,
    });

    const seen: unknown[][] = [];
    adapter.observe(() => {}, (composersFound) => seen.push(composersFound));
    expect(seen).toHaveLength(1);

    // Same set on rescan → no duplicate report.
    getCallback()!();
    expect(seen).toHaveLength(1);

    // A fresh composer appears (SPA re-render) → reported exactly once.
    const fresh = { tagName: 'TEXTAREA' };
    composers.push(fresh);
    getCallback()!();
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual([fresh]);
  });

  test('composer callback is optional (backwards compatible)', () => {
    const { Ctor, getCallback } = makeCapturer();
    const composer = { tagName: 'TEXTAREA' };
    const adapter = new YouTubeAdapter({
      root: makeComposerRoot([composer]) as never,
      MutationObserver: Ctor as never,
    });

    // No composer callback — must not throw on initial scan or rescan.
    expect(() => adapter.observe(() => {})).not.toThrow();
    expect(() => getCallback()!()).not.toThrow();
  });

  test('adapters without a composer selector never fire the composer callback', () => {
    const { Ctor, getCallback } = makeCapturer();
    const adapter = new YouTubeAdapter({
      root: { querySelectorAll: vi.fn(() => []) } as never,
      MutationObserver: Ctor as never,
    });
    adapter.commentTextareaSelector = undefined;

    const seen: unknown[][] = [];
    adapter.observe(() => {}, (composers) => seen.push(composers));
    getCallback()!();
    expect(seen).toHaveLength(0);
  });
});
// --- M14: reply-thread context extraction ---

interface TaggedFake {
  tagName?: string;
  parentNode?: TaggedFake | null;
  querySelectorAll: (sel: string) => unknown[];
  querySelector: (sel: string) => unknown;
  getAttribute: (name: string) => string | null;
  textContent: string | null;
}

/** A comment renderer fake with YouTube's text/author selectors wired up. */
function makeRenderer(text: string, author: string): TaggedFake {
  const textSpan: TaggedFake = {
    tagName: '#span',
    querySelectorAll: () => [],
    querySelector: () => null,
    getAttribute: () => null,
    textContent: text,
  };
  const anchor: TaggedFake = {
    tagName: '#a',
    querySelectorAll: () => [],
    querySelector: () => null,
    getAttribute: () => null,
    textContent: author,
  };
  return {
    tagName: 'ytd-comment-renderer',
    parentNode: null,
    querySelectorAll: (sel: string) => (sel === '#content-text' ? [textSpan] : []),
    querySelector: (sel: string) => (sel === '#author-text' ? anchor : null),
    getAttribute: () => null,
    textContent: '',
  };
}

describe('YouTubeAdapter (reply threads, M14)', () => {
  test('parses thread containers: top-level comment plus replies with parent context', () => {
    const top = makeRenderer('parent comment text', 'parent_author');
    const reply = makeRenderer('reply text', 'reply_author');
    const thread: TaggedFake = {
      tagName: 'ytd-comment-thread-renderer',
      parentNode: null,
      querySelectorAll: (sel: string) =>
        sel === 'ytd-comment-renderer' ? [top, reply] : [],
      querySelector: () => null,
      getAttribute: () => null,
      textContent: '',
    };
    // Structural parent chain: both renderers live inside the thread.
    top.parentNode = thread;
    reply.parentNode = thread;
    const root = { querySelectorAll: () => [thread] };

    const adapter = new YouTubeAdapter({ root: root as any });
    const comments = adapter.extractComments();

    expect(comments).toHaveLength(2);
    const [parsedTop, parsedReply] = comments;

    // Top-level: no thread context.
    expect(parsedTop.text).toBe('parent comment text');
    expect(parsedTop.parentId).toBeUndefined();
    expect(parsedTop.parentText).toBeUndefined();
    expect(parsedTop.depth).toBeUndefined();

    // Reply: carries the parent's id and text for context analysis.
    expect(parsedReply.text).toBe('reply text');
    expect(parsedReply.parentId).toBe(parsedTop.id);
    expect(parsedReply.parentText).toBe('parent comment text');
    expect(parsedReply.depth).toBe(1);
  });

  test('resolves parent context for a reply discovered via the secondary (flat) path', () => {
    const top = makeRenderer('the parent says something rude', 'parent_author');
    const reply = makeRenderer('a reply', 'reply_author');
    const thread: TaggedFake = {
      tagName: 'ytd-comment-thread-renderer',
      parentNode: null,
      querySelectorAll: (sel: string) =>
        sel === 'ytd-comment-renderer' ? [top, reply] : [],
      querySelector: () => null,
      getAttribute: () => null,
      textContent: '',
    };
    // Attach the reply into the thread's parent chain (structural parentNode).
    reply.parentNode = thread as unknown as TaggedFake;

    // Secondary path: the scan yields the reply renderer directly.
    const root = { querySelectorAll: (sel: string) => (sel.includes('comment-renderer') ? [reply] : []) };
    const adapter = new YouTubeAdapter({ root: root as any });
    const comments = adapter.extractComments();

    expect(comments).toHaveLength(1);
    expect(comments[0].text).toBe('a reply');
    expect(comments[0].parentText).toBe('the parent says something rude');
    expect(comments[0].depth).toBe(1);
    expect(comments[0].parentId).toBeTruthy();
  });

  test('a top-level comment with no thread ancestor gets no parent context', () => {
    const top = makeRenderer('standalone comment', 'someone');
    const root = { querySelectorAll: () => [top] };
    const adapter = new YouTubeAdapter({ root: root as any });
    const comments = adapter.extractComments();
    expect(comments).toHaveLength(1);
    expect(comments[0].parentId).toBeUndefined();
    expect(comments[0].parentText).toBeUndefined();
    expect(comments[0].depth).toBeUndefined();
  });
});
