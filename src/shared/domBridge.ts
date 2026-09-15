import type { UiDocument, UiElement, UiWindow } from './uiTypes';

/**
 * domBridge.ts — the single, documented, *unsafe* seam between the real DOM
 * and the structural `Ui*` interfaces (see `shared/uiTypes.ts`).
 *
 * The structural interfaces exist so UI/adapter logic can be unit tested in
 * Node without jsdom; the real DOM satisfies them at runtime but TypeScript
 * cannot prove it structurally. Instead of scattering `as unknown as X`
 * casts across adapters and entry points (the previous pattern, now guarded
 * against by `tests/unit/domBoundary.test.ts`), every crossing of that
 * boundary goes through these functions so the unavoidable runtime
 * assumption lives in exactly one auditable place.
 *
 * Invariant: pass only real DOM values obtained from the page (or, in tests,
 * fakes that actually implement the structural surface). No validation or
 * transformation happens here by design — that is the seam's contract.
 */

/** View a real DOM `Element` as the structural `UiElement` shape. */
export function asUiElement(el: Element): UiElement {
  return el as unknown as UiElement;
}

/** View the real DOM `document` as the structural `UiDocument` shape. */
export function asUiDocument(doc: Document): UiDocument {
  return doc as unknown as UiDocument;
}

/** View the real DOM `window` as the structural `UiWindow` shape. */
export function asUiWindow(win: Window): UiWindow {
  return win as unknown as UiWindow;
}

/** View a structural `UiElement` as a real DOM `Element` (reverse crossing).
 *
 * Needed when structural UI builders (e.g. `createRainbowButton`) run inside
 * a real-DOM host such as the settings page: the builder returns a `UiElement`
 * that is really a DOM node, and the host must append it to real containers.
 * Centralized here so the DOM-boundary guard (`tests/unit/domBoundary.test.ts`)
 * keeps exactly one sanctioned home for boundary casts. */
export function toRealElement(el: UiElement): Element {
  return el as unknown as Element;
}

/** Append a structural `UiElement` to a real DOM host element. */
export function appendUiElement(host: Element, child: UiElement): void {
  host.appendChild(toRealElement(child) as Node);
}

