import type { CommentAnalysis, CommentData } from '../../shared/types';
import { openAnalysisModal } from './analysisModal';
import {
  RAINBOW_GRADIENT,
  type CommentControlsOptions,
  type UiDocument,
  type UiElement,
  type UiWindow,
} from './uiTypes';

export * from './uiTypes';
export * from './analysisModal';
export * from './draftReview';

/** Apply inline CSS values to a UI element. */
function styles(el: UiElement, values: Record<string, string>): void {
  if (el.style) Object.assign(el.style, values);
}

/**
 * Create the rainbow NoH8 button for a comment. Clicking it opens the analysis
 * modal. Extracted from `renderCommentControls` so the same button can be
 * anchored to a platform-specific element (e.g. Instagram's heart button)
 * rather than always appended to the comment container.
 */
export function createRainbowButton(
  doc: UiDocument,
  comment: CommentData,
  analysis: CommentAnalysis,
  windowRef?: UiWindow
): UiElement {
  const button = doc.createElement('button');
  button.setAttribute?.('data-noh8-rainbow', 'true');
  button.setAttribute?.('type', 'button');
  button.setAttribute?.(
    'aria-label',
    `View NoH8 analysis for comment by ${comment.author}`
  );
  if (button.dataset) button.dataset['noh8Rainbow'] = 'true';
  button.textContent = '🌈';

  styles(button, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    margin: '2px 6px 2px 0',
    padding: '0',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '16px',
    background: `linear-gradient(135deg, ${RAINBOW_GRADIENT})`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
    verticalAlign: 'middle',
  });

  button.addEventListener?.('click', () => {
    openAnalysisModal({ doc, comment, analysis, windowRef });
  });

  return button;
}

/**
 * Append a rainbow button to a comment container. Clicking it opens the modal
 * with the comment's analysis. Repeated calls are a no-op so the button is
 * only ever rendered once.
 *
 * When `heartButtonSelector` is provided and matches an element within the
 * container, the rainbow button is inserted immediately after that element
 * (beneath the comment's heart/like button on Instagram) instead of being
 * appended to the end of the comment container. If the anchor can't be found,
 * the button gracefully falls back to being appended to the container.
 */
export function renderCommentControls(options: CommentControlsOptions): void {
  const { container, comment, analysis, doc, windowRef, heartButtonSelector } =
    options;
  if (container.dataset?.['noh8RainbowButton'] === 'true') return;

  if (container.setAttribute) container.setAttribute('data-noh8-controls', 'true');
  if (container.dataset) container.dataset['noh8RainbowButton'] = 'true';

  const button = createRainbowButton(doc, comment, analysis, windowRef);

  if (heartButtonSelector) {
    const heart = container.querySelector?.(heartButtonSelector) ?? null;
    const anchorParent = heart?.parentNode ?? null;
    if (anchorParent && typeof anchorParent.insertBefore === 'function') {
      // Place the rainbow button directly beneath the heart button.
      anchorParent.insertBefore(button, heart?.nextSibling ?? null);
      return;
    }
  }

  // Default: append to the comment container.
  container.appendChild?.(button);
}