import type { UiElement } from '../../shared/uiTypes';

/**
 * Reply-thread ancestor resolution for platform adapters (M14).
 *
 * Social platforms nest replies in one of two shapes, and adapters need a
 * structural (real-DOM-free) way to resolve a reply's parent comment for the
 * context analysis pipeline (`parentText` / `parentId` / `depth` on
 * `CommentData`):
 *
 * 1. **Sibling threads (YouTube):** the top-level comment and its replies are
 *    siblings inside a thread container element. Resolution walks the parent
 *    chain to the thread container by tag name, then takes the first comment
 *    element inside it (document order puts the top-level comment first).
 * 2. **Nested containers (Instagram / Facebook):** each reply is rendered
 *    inside its parent comment's container element. Resolution walks the
 *    parent chain looking for an already-parsed comment element.
 *
 * Pure and structural: everything operates on the `UiElement` interface from
 * `shared/uiTypes.ts`, so no real DOM types and no ad-hoc casts are needed.
 */

/** Info an adapter has already extracted for a parsed comment element. */
export interface ParsedCommentInfo {
  id: string;
  text: string;
  depth: number;
}

/**
 * Find the nearest ancestor of `item` whose tag name equals `tagName`
 * (case-insensitive). Returns null when the item has no such ancestor; the
 * item itself is never considered.
 */
export function findAncestorByTagName(item: UiElement, tagName: string): UiElement | null {
  const target = tagName.toLowerCase();
  let node = item.parentNode ?? null;
  while (node) {
    if ((node.tagName ?? '').toLowerCase() === target) return node;
    node = node.parentNode ?? null;
  }
  return null;
}

/**
 * Return the first descendant of `container` matching the (tag) selector, or
 * null. Document order puts the top-level comment before its replies inside a
 * thread container, so the first match is the thread's top-level comment.
 */
export function firstDescendantByTagName(
  container: UiElement,
  selector: string
): UiElement | null {
  const list = container.querySelectorAll(selector);
  const first = Array.from(list as ArrayLike<UiElement>)[0];
  return first ?? null;
}

/**
 * Find the nearest already-parsed comment element that encloses `item`
 * (containment-based nesting, e.g. Instagram / Facebook). Returns the parsed
 * info of that ancestor or null when the item is top-level.
 */
export function findParsedAncestor(
  item: UiElement,
  parsed: Map<UiElement, ParsedCommentInfo>
): ParsedCommentInfo | null {
  let node = item.parentNode ?? null;
  while (node) {
    const info = parsed.get(node);
    if (info) return info;
    node = node.parentNode ?? null;
  }
  return null;
}
