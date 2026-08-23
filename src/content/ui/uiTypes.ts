import type { CommentAnalysis, CommentData } from '../../shared/types';

/**
 * Structural DOM interfaces. These keep the UI decoupled from the real
 * DOM so its logic can be unit tested in Node without jsdom.
 */
export interface UiElement {
  textContent: string | null;
  /** For <textarea> elements — the current input value. Optional so the same
   * interface also works for contenteditable elements that expose text via
   * `textContent`. */
  value?: string | null;
  appendChild?(node: UiElement): void;
  setAttribute?(name: string, value: string): void;
  addEventListener?(type: string, listener: (event?: unknown) => void): void;
  style?: Record<string, string>;
  dataset?: Record<string, string>;
  remove?(): void;
  parentNode?: UiElement | null;
  nextSibling?: UiElement | null;
  insertBefore?(node: UiElement, ref: UiElement | null): void;
  querySelector?(selector: string): UiElement | null;
}

export interface UiDocument {
  createElement(tag: string): UiElement;
  body: UiElement;
}

export interface UiWindow {
  open(url: string, target?: string): void;
}

export interface CommentControlsOptions {
  /** The comment DOM container the rainbow button is appended to. */
  container: UiElement;
  comment: CommentData;
  analysis: CommentAnalysis;
  doc: UiDocument;
  windowRef?: UiWindow;
  /** Instagram-only: selector for the comment's heart/like button. When set and
   * matched, the rainbow button is anchored beneath it; otherwise it is
   * appended to the comment container (default). */
  heartButtonSelector?: string;
}

export interface ModalOptions {
  doc: UiDocument;
  comment: CommentData;
  analysis: CommentAnalysis;
  windowRef?: UiWindow;
}

export interface DraftReviewOptions {
  /** The textarea (or contenteditable) element the user is composing in. */
  textarea: UiElement;
  /** Platform name — used for the report flow and draft id generation. */
  platform: string;
  doc: UiDocument;
  windowRef?: UiWindow;
  /**
   * Author label shown in the modal header. Defaults to "You" since the user
   * is reviewing their *own* draft.
   */
  author?: string;
  /**
   * Analyze the current draft text. Receives a `{ id, text }` payload and
   * must resolve with the on-device analysis to show in the modal. Typically
   * the content-script `inferComment` helper.
   */
  analyze: (draft: Pick<CommentData, 'id' | 'text'>) => Promise<CommentAnalysis>;
}

export const RAINBOW_GRADIENT = [
  '#ff0000',
  '#ff8000',
  '#ffff00',
  '#00ff00',
  '#00f0ff',
  '#4000ff',
  '#a000ff',
].join(', ');
