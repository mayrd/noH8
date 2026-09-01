import { describe, test, expect } from 'vitest';
import {
  findAncestorByTagName,
  firstDescendantByTagName,
  findParsedAncestor,
} from '../../src/content/adapters/replyContext';
import type { UiElement } from '../../src/shared/uiTypes';

/** Minimal structural element with a parent chain and optional tag name. */
function el(
  tagName: string,
  opts: { parent?: FakeNode | null } = {}
): UiElement & { tag: string; parent: FakeNode | null } {
  return {
    tag: tagName,
    tagName,
    parent: opts.parent ?? null,
    get parentNode(): UiElement | null {
      return (this.parent as unknown as UiElement) ?? null;
    },
    textContent: '',
    querySelectorAll: () => [],
  } as unknown as UiElement & { tag: string; parent: FakeNode | null };
}
type FakeNode = ReturnType<typeof el>;

function chain(...nodes: FakeNode[]): void {
  for (let i = 0; i < nodes.length - 1; i += 1) {
    nodes[i].parent = nodes[i + 1];
  }
}

describe('replyContext helpers (M14)', () => {
  describe('findAncestorByTagName', () => {
    test('finds the nearest ancestor matching the tag name', () => {
      const reply = el('ytd-comment-renderer');
      const thread = el('ytd-comment-thread-renderer');
      const section = el('ytd-section-renderer');
      chain(reply, thread, section);
      expect(findAncestorByTagName(reply, 'ytd-comment-thread-renderer')).toBe(thread);
    });

    test('is case-insensitive and skips non-matching ancestors', () => {
      const reply = el('div');
      const wrapper = el('SPAN');
      const thread = el('ytd-comment-thread-renderer');
      chain(reply, wrapper, thread);
      expect(findAncestorByTagName(reply, 'ytd-comment-thread-renderer')).toBe(thread);
    });

    test('returns null when the item has no matching ancestor', () => {
      const item = el('div');
      const wrapper = el('span');
      chain(item, wrapper);
      expect(findAncestorByTagName(item, 'ytd-comment-thread-renderer')).toBeNull();
    });

    test('does not match the item itself, only ancestors', () => {
      const thread = el('ytd-comment-thread-renderer');
      const top = el('ytd-comment-renderer', { parent: thread });
      expect(findAncestorByTagName(top, 'ytd-comment-thread-renderer')).toBe(thread);
    });
  });

  describe('firstDescendantByTagName', () => {
    test('returns the first descendant matching the tag selector', () => {
      const topLevel = el('ytd-comment-renderer');
      const thread = el('ytd-comment-thread-renderer');
      (thread as unknown as { querySelectorAll: (s: string) => unknown }).querySelectorAll =
        (sel: string) => (sel === 'ytd-comment-renderer' ? [topLevel] : []);
      expect(firstDescendantByTagName(thread, 'ytd-comment-renderer')).toBe(topLevel);
    });

    test('returns null when the container has no matching descendant', () => {
      const thread = el('ytd-comment-thread-renderer');
      expect(firstDescendantByTagName(thread, 'ytd-comment-renderer')).toBeNull();
    });
  });

  describe('findParsedAncestor (containment-based, Instagram/Facebook nesting)', () => {
    test('finds the nearest already-parsed comment enclosing the item', () => {
      const parent = el('div', {});
      const childReply = el('div', { parent: parent as unknown as FakeNode });
      const parsed = new Map<UiElement, { id: string; text: string; depth: number }>();
      parsed.set(parent as UiElement, { id: 'parent-1', text: 'parent text', depth: 0 });
      expect(findParsedAncestor(childReply as UiElement, parsed)).toEqual({
        id: 'parent-1',
        text: 'parent text',
        depth: 0,
      });
    });

    test('returns null for a top-level comment with no parsed ancestor', () => {
      const item = el('div');
      const wrapper = el('div', { parent: item as unknown as FakeNode });
      const parsed = new Map<UiElement, { id: string; text: string; depth: number }>();
      expect(findParsedAncestor(item as UiElement, parsed)).toBeNull();
      expect(findParsedAncestor(wrapper as UiElement, parsed)).toBeNull();
    });

    test('finds ancestors several levels up the parent chain', () => {
      const grandparent = el('div');
      const mid = el('div', { parent: grandparent as unknown as FakeNode });
      const reply = el('div', { parent: mid });
      const parsed = new Map<UiElement, { id: string; text: string; depth: number }>();
      parsed.set(grandparent as UiElement, { id: 'gp', text: 'gp text', depth: 2 });
      expect(findParsedAncestor(reply as UiElement, parsed)).toEqual({
        id: 'gp',
        text: 'gp text',
        depth: 2,
      });
    });
  });
});
