import type { CommentAnalysis, CommentData } from '../../shared/types';
import type {
  UiDocument,
  UiElement,
  UiWindow,
} from '../../shared/uiTypes';

/**
 * Structural DOM types live in `shared/uiTypes.ts` (single source of truth
 * shared with the platform adapters); they are re-exported here so the UI
 * modules keep their existing import paths.
 */
export type { UiDocument, UiElement, UiWindow } from '../../shared/uiTypes';

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
  /**
   * The element that opened the modal (e.g. the rainbow button). On close,
   * keyboard focus is returned to it (M15 accessibility).
   */
  trigger?: UiElement;
  /**
   * (L2) Injectable clipboard seam used to copy the report evidence snippet
   * before navigation. Defaults to the runtime `navigator.clipboard`.
   */
  clipboard?: import('./reportHelper').ClipboardSeam;
  /**
   * (L3) Pre-post warning shown at the top of the modal when the user reviews
   * their *own* draft and the analysis flags it. Renders an i18n banner
   * (`data-noh8-draft-warning`) above the sentiment section; unset for
   * regular comment analyses.
   */
  draftWarning?: string;
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
