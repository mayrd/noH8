/**
 * Shared structural DOM interfaces.
 *
 * These are the single source of truth for the structural ("UI-shaped") DOM
 * types used by both the content-script UI modules and the platform adapters,
 * so their logic can be unit tested in Node without jsdom. Real DOM types
 * (`Element`, `Document`, `Window`) are structurally close but not assignable,
 * so every real-DOM → structural crossing must go through the single unsafe
 * seam in `shared/domBridge.ts` — never through ad-hoc double casts.
 */
export interface UiElement {
  textContent: string | null;
  /** Lowercase tag name when the host element exposes one (real DOM elements
   * do; used by reply-thread ancestor resolution, M14). */
  tagName?: string;
  /** For <textarea> elements — the current input value. Optional so the same
   * interface also works for contenteditable elements that expose text via
   * `textContent`. */
  value?: string | null;
  getAttribute?(name: string): string | null;
  appendChild?(node: UiElement): void;
  setAttribute?(name: string, value: string): void;
  addEventListener?(type: string, listener: (event?: unknown) => void): void;
  style?: Record<string, string | undefined>;
  dataset?: Record<string, string | undefined>;
  remove?(): void;
  /** Move keyboard focus to this element (modal open/close focus management). */
  focus?(): void;
  parentNode?: UiElement | null;
  nextSibling?: UiElement | null;
  insertBefore?(node: UiElement, ref: UiElement | null): void;
  querySelector?(selector: string): UiElement | null;
  querySelectorAll(selector: string): UiElement[] | NodeListOf<Element>;
  /** Smooth-scroll support used by the sidepanel "Jump to comment" flow. */
  scrollIntoView?(arg?: { behavior?: string; block?: string }): void;
  /**
   * Programmatic click, used by the report flow to activate a temporary
   * `target="_blank" rel="noopener noreferrer"` anchor (L2). Real DOM
   * elements expose it; fakes may fire recorded handlers.
   */
  click?(): void;
}

export interface UiDocument {
  createElement(tag: string): UiElement;
  body: UiElement;
}

export interface UiWindow {
  open(url: string, target?: string): void;
}
