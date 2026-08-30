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
  parentNode?: UiElement | null;
  nextSibling?: UiElement | null;
  insertBefore?(node: UiElement, ref: UiElement | null): void;
  querySelector?(selector: string): UiElement | null;
  querySelectorAll(selector: string): UiElement[] | NodeListOf<Element>;
  /** Smooth-scroll support used by the sidepanel "Jump to comment" flow. */
  scrollIntoView?(arg?: { behavior?: string; block?: string }): void;
}

export interface UiDocument {
  createElement(tag: string): UiElement;
  body: UiElement;
}

export interface UiWindow {
  open(url: string, target?: string): void;
}
