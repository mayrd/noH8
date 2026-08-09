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

export interface ElementLike {
  textContent: string | null;
  getAttribute?(name: string): string | null;
  querySelector?(selector: string): ElementLike | null;
  querySelectorAll(selector: string): ElementLike[] | NodeListOf<Element>;
  appendChild?(node: ElementLike): void;
  setAttribute?(name: string, value: string): void;
}

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
 * returns a real `ElementLike[]`.
 */
export function queryAll(root: RootLike, selector: string): ElementLike[] {
  const list = root.querySelectorAll(selector);
  return Array.from(list as ArrayLike<ElementLike>);
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
