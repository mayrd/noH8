/**
 * selectorStrategy.ts
 *
 * Shared, DOM-agnostic comment-container selection logic used by every platform
 * adapter. Social-media DOMs are heavily obfuscated and change frequently, so
 * each adapter declares an ordered pair of selector sets:
 *
 *   - `primary`    : the preferred structural selectors for the platform.
 *   - `secondary`  : documented fallback selectors used only when the primary
 *                    set yields nothing.
 *
 * The strategy tries `primary` first; if it finds nothing it logs a one-time
 * warning (so regressions are visible without spamming the console) and retries
 * with `secondary`. It never throws — a failed/obfuscated DOM simply yields
 * zero containers.
 */

import type { UiElement } from '../../shared/uiTypes';

/**
 * Structural element type shared with the UI (single source of truth in
 * `shared/uiTypes.ts`). Kept as a local alias so the selector-strategy API
 * and adapter code keep reading naturally.
 */
export type ElementLike = UiElement;

export interface RootLike {
  querySelectorAll(selector: string): ElementLike[] | NodeListOf<Element>;
}

export interface DocumentLike {
  createElement(tagName: string): ElementLike;
}

export type MutationObserverCtor = new (callback: () => void) => {
  observe(target: unknown, options?: unknown): void;
  disconnect(): void;
};

/** A no-op MutationObserver used when the real one is unavailable (e.g. tests). */
export const NoopMutationObserver = class {
  observe(_target: unknown, _options?: unknown): void {}
  disconnect(): void {}
} as MutationObserverCtor;

export interface CommentSelectors {
  /** Primary structural selectors tried first. */
  primary: string[];
  /** Fallback selectors tried (only) when the primary set yields nothing. */
  secondary?: string[];
}

/**
 * Array-form wrapper around `root.querySelectorAll(selector)` that always
 * returns a real `ElementLike[]`. Also descends into open shadow roots
 * (e.g. YouTube's `ytd-*` custom elements render `#content-text` inside a
 * `shadowRoot` that host-level `querySelectorAll` cannot see), so comments
 * hidden inside shadow DOM are still found at query time.
 *
 * Guarded against pathological DOMs: traversal depth is capped and each
 * node is visited once, so cyclic `shadowRoot` fakes cannot hang the scan.
 */
export function queryAll(root: RootLike, selector: string): ElementLike[] {
  const found: ElementLike[] = [];
  const seenElements = new Set<ElementLike>();
  const visitedNodes = new Set<unknown>();
  // Roots that expose shadow content (real ShadowRoot or the UiElement
  // structural seam) are descended into explicitly.
  interface Shadowed {
    shadowRoot?: unknown;
  }
  const MAX_SHADOW_DEPTH = 8;
  const queue: Array<{ node: RootLike | ElementLike; depth: number }> = [
    { node: root, depth: 0 },
  ];
  const enqueueShadow = (host: unknown, depth: number): void => {
    if (depth >= MAX_SHADOW_DEPTH) return;
    const sr = (host as Shadowed).shadowRoot;
    if (
      sr &&
      typeof (sr as RootLike).querySelectorAll === 'function' &&
      !visitedNodes.has(sr)
    ) {
      queue.push({ node: sr as RootLike, depth: depth + 1 });
    }
  };
  while (queue.length > 0) {
    const entry = queue.shift();
    if (!entry) continue;
    const { node, depth } = entry;
    if (visitedNodes.has(node)) continue;
    visitedNodes.add(node);
    let list: ArrayLike<ElementLike>;
    try {
      list = node.querySelectorAll(selector) as ArrayLike<ElementLike>;
    } catch {
      continue;
    }
    for (const el of Array.from(list)) {
      if (!seenElements.has(el)) {
        seenElements.add(el);
        found.push(el);
      }
    }
    // Descend into the node's own shadow root (a shadow root passed
    // directly has no shadowRoot of its own, so this is a no-op for it).
    enqueueShadow(node, depth);
    // Matches inside a shadow tree are invisible to the host-level query
    // above (real DOM `querySelectorAll` never pierces shadow boundaries),
    // so also queue every *directly known* child host's shadow root. The
    // breadth-first queue keeps this bounded by the visited set.
    if (depth < MAX_SHADOW_DEPTH) {
      for (const el of Array.from(list)) enqueueShadow(el, depth);
    }
  }
  return found;
}

/**
 * Shadow-piercing `querySelector`: return the first element matching
 * `selector` in light DOM, falling back to a breadth-first search of open
 * shadow roots. Never throws — returns null when nothing matches or the
 * selector itself is unsupported.
 */
export function queryOne(
  root: { querySelector?: ((selector: string) => ElementLike | null) | undefined } & RootLike,
  selector: string
): ElementLike | null {
  try {
    const direct = root.querySelector?.(selector) ?? null;
    if (direct) return direct;
  } catch {
    return null;
  }
  return queryAll(root, selector)[0] ?? null;
}

// One-time warning throttle for "primary selector yielded no nodes".
let warnEmitted = false;

/** Reset the one-time warning throttle. Intended for unit tests. */
export function resetSelectorWarn(): void {
  warnEmitted = false;
}

/**
 * Resolve comment container elements from `root` using a primary/secondary
 * selector strategy. Never throws.
 */
export function selectCommentContainers(
  root: RootLike | null,
  selectors: CommentSelectors
): ElementLike[] {
  if (!root) return [];

  const trySelectors = (sels: string[]): ElementLike[] => {
    try {
      return queryAll(root, sels.join(', '));
    } catch {
      return [];
    }
  };

  const primary = trySelectors(selectors.primary);
  if (primary.length > 0) return primary;

  if (selectors.secondary && selectors.secondary.length > 0) {
    if (!warnEmitted) {
      warnEmitted = true;
      console.warn(
        '[NoH8] primary comment selector yielded no nodes; falling back to secondary selectors'
      );
    }
    return trySelectors(selectors.secondary);
  }

  return [];
}
