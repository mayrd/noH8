import { describe, test, expect, vi } from 'vitest';
import InstagramAdapter from '../../src/content/adapters/instagramAdapter';
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

const INSTAGRAM_MATCHES = getMatchesForPlatform('instagram');

describe('InstagramAdapter', () => {
  test('identifies itself as the instagram platform', () => {
    const adapter = new InstagramAdapter();
    expect(adapter.platformName).toBe('instagram');
  });

    test('declares the instagram domains it should parse in the browser', () => {
    const adapter = new InstagramAdapter();
    expect(adapter.hostPermissions).toEqual(INSTAGRAM_MATCHES);
    expect(adapter.hostPermissions).toContain('https://www.instagram.com/*');
  });

  test('exposes a comment textarea selector for draft review', () => {
    expect(InstagramAdapter.commentTextareaSelector).toBeTruthy();
    expect(typeof InstagramAdapter.commentTextareaSelector).toBe('string');
    const adapter = new InstagramAdapter();
    expect(adapter.commentTextareaSelector).toBe(InstagramAdapter.commentTextareaSelector);
  });
test('extractComments parses comment text, author and element refs from the DOM', () => {
    const commentEl = makeCommentEl('you are toxic', 'tester_user', {
      textSelector: InstagramAdapter.commentTextSelector,
    });
    const root = { querySelectorAll: vi.fn(() => [commentEl]) };

    const adapter = new InstagramAdapter({ root: root as any });
    const comments = adapter.extractComments();

    expect(comments).toHaveLength(1);
    expect(comments[0].platform).toBe('instagram');
    expect(comments[0].text).toBe('you are toxic');
    expect(comments[0].author).toBe('tester_user');
    expect(comments[0].elementRef).toBe(commentEl);
    expect(comments[0].id).toBeTruthy();
  });

  test('extractComments skips comment containers without any text', () => {
    const emptyEl = makeCommentEl('', 'tester_user', {
      textSelector: InstagramAdapter.commentTextSelector,
    });
    const root = { querySelectorAll: vi.fn(() => [emptyEl]) };

    const adapter = new InstagramAdapter({ root: root as any });
    expect(adapter.extractComments()).toHaveLength(0);
  });

  test('injectWarning appends a banner element to the matching comment element', () => {
    const commentEl = makeCommentEl('hateful text', 'author_x', {
      textSelector: InstagramAdapter.commentTextSelector,
    });
    const root = { querySelectorAll: vi.fn(() => [commentEl]) };
    const doc = makeDoc();

    const adapter = new InstagramAdapter({ root: root as any, document: doc as any });

    // warm the comment-element registry so injectWarning can resolve the target
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
    const adapter = new InstagramAdapter({ root: null as any, document: doc as any });
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
      textSelector: InstagramAdapter.commentTextSelector,
    });
    const items = [itemA];
    const root = { querySelectorAll: vi.fn(() => items) };

    const adapter = new InstagramAdapter({ root: root as any, MutationObserver: Ctor as any });

    const calls: any[] = [];
    adapter.observe((comments) => calls.push(comments.map((c) => c.id)));

    // Initial scan reports the already-present comment once.
    expect(calls).toHaveLength(1);

    // Simulate a DOM mutation that adds a second comment.
    const itemB = makeCommentEl('second comment', 'bob', {
      textSelector: InstagramAdapter.commentTextSelector,
    });
    items.push(itemB);
    getCallback()!();

    expect(calls).toHaveLength(2);
    expect(calls[1]).toHaveLength(1); // only the new comment, not the duplicate
    expect(calls[0][0]).not.toBe(calls[1][0]);
    expect(adapter.extractComments()).toHaveLength(2);
  });

  test('declares an Instagram heart/like button selector used to anchor the rainbow button', () => {
    expect(InstagramAdapter.heartButtonSelector).toBeTruthy();
    expect(typeof InstagramAdapter.heartButtonSelector).toBe('string');
    // Targets the like/unlike aria-label on the comment's heart button.
    expect(InstagramAdapter.heartButtonSelector).toContain('like');
  });

  test('exposes the heart button anchor selector at runtime on the adapter instance', () => {
    const adapter = new InstagramAdapter();
    expect(adapter.commentAnchorSelector).toBe(InstagramAdapter.heartButtonSelector);
    expect(adapter.commentAnchorSelector).toBeTruthy();
  });
});
// --- M14: nested reply context extraction (containment-based) ---

interface TaggedFakeEl {
  tagName?: string;
  parentNode?: TaggedFakeEl | null;
  querySelectorAll: (sel: string) => unknown[];
  querySelector: (sel: string) => unknown;
  getAttribute: (name: string) => string | null;
  textContent: string | null;
}

function makeNestedComment(text: string, author: string): TaggedFakeEl {
  const textNode: TaggedFakeEl = {
    tagName: 'div',
    querySelectorAll: () => [],
    querySelector: () => null,
    getAttribute: () => null,
    textContent: text,
  };
  const authorNode: TaggedFakeEl = {
    tagName: 'a',
    querySelectorAll: () => [],
    querySelector: () => null,
    getAttribute: () => null,
    textContent: author,
  };
  return {
    tagName: 'ul',
    parentNode: null,
    querySelectorAll: (sel: string) => (sel === 'span[dir="auto"]' ? [textNode] : []),
    querySelector: (sel: string) => (sel.startsWith('a[') ? authorNode : null),
    getAttribute: () => null,
    textContent: '',
  };
}

describe('InstagramAdapter (nested replies, M14)', () => {
  test('a nested reply carries its parent comment id, text and depth', () => {
    const parent = makeNestedComment('parent says hi', 'parent_user');
    const reply = makeNestedComment('nested reply', 'reply_user');
    // Instagram nests replies inside the parent comment's container subtree.
    const repliesWrapper: TaggedFakeEl = {
      tagName: 'ul',
      parentNode: null,
      querySelectorAll: () => [],
      querySelector: () => null,
      getAttribute: () => null,
      textContent: '',
    };
    reply.parentNode = repliesWrapper;
    repliesWrapper.parentNode = parent as unknown as TaggedFakeEl;

    const root = { querySelectorAll: () => [parent, reply] };
    const adapter = new InstagramAdapter({ root: root as any });
    const comments = adapter.extractComments();

    expect(comments).toHaveLength(2);
    expect(comments[0].text).toBe('parent says hi');
    expect(comments[0].parentId).toBeUndefined();
    expect(comments[0].depth).toBeUndefined();

    expect(comments[1].text).toBe('nested reply');
    expect(comments[1].parentId).toBe(comments[0].id);
    expect(comments[1].parentText).toBe('parent says hi');
    expect(comments[1].depth).toBe(1);
  });

  test('a reply to a reply increments depth (depth 2)', () => {
    const parent = makeNestedComment('root comment', 'root_user');
    const mid = makeNestedComment('mid reply', 'mid_user');
    const leaf = makeNestedComment('leaf reply', 'leaf_user');

    const midWrapper: TaggedFakeEl = {
      tagName: 'ul', parentNode: null, querySelectorAll: () => [],
      querySelector: () => null, getAttribute: () => null, textContent: '',
    };
    const leafWrapper: TaggedFakeEl = {
      tagName: 'ul', parentNode: null, querySelectorAll: () => [],
      querySelector: () => null, getAttribute: () => null, textContent: '',
    };
    mid.parentNode = midWrapper;
    midWrapper.parentNode = parent as unknown as TaggedFakeEl;
    leaf.parentNode = leafWrapper;
    leafWrapper.parentNode = mid as unknown as TaggedFakeEl;

    const root = { querySelectorAll: () => [parent, mid, leaf] };
    const adapter = new InstagramAdapter({ root: root as any });
    const comments = adapter.extractComments();

    expect(comments).toHaveLength(3);
    expect(comments[1].parentId).toBe(comments[0].id);
    expect(comments[1].depth).toBe(1);
    expect(comments[2].parentId).toBe(comments[1].id);
    expect(comments[2].parentText).toBe('mid reply');
    expect(comments[2].depth).toBe(2);
  });
});
