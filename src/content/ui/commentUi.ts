import type { CommentData } from '../../shared/types';
import { t } from '../../shared/i18n';
import { injectRainbowMotionStyles } from './motion';
import { openAnalysisModal } from './analysisModal';
import { queryOne } from '../adapters/selectorStrategy';
import {
  RAINBOW_GRADIENT,
  type CommentControlsOptions,
  type LiveAnalysis,
  type UiDocument,
  type UiElement,
  type UiWindow,
} from './uiTypes';
import type { CommentAnalysis } from '../../shared/types';

export * from './uiTypes';
export * from './analysisModal';
export * from './draftReview';
export type { LiveAnalysis } from './uiTypes';

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
  analysis: CommentAnalysis | LiveAnalysis,
  windowRef?: UiWindow
): UiElement {
  const button = doc.createElement('button');
  injectRainbowMotionStyles(doc);
  button.setAttribute?.('data-noh8-rainbow', 'true');
  button.setAttribute?.('type', 'button');
  button.setAttribute?.(
    'aria-label',
    t('rainbowButton.label', { author: comment.author })
  );
  button.setAttribute?.('class', 'noh8-rainbow-animated');
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
    // Resolve the analysis lazily so optimistic renders (which pass a
    // LiveAnalysis holder) open the modal with the resolved inference,
    // not the placeholder snapshot from render time. The holder object is
    // shared by reference with the content script, which swaps `.current`
    // when async inference lands.
    const live = isLiveAnalysis(analysis) ? analysis.current : analysis;
    openAnalysisModal({ doc, comment, analysis: live, windowRef, trigger: button });
  });

  return button;
}

/** Type guard: a LiveAnalysis holder vs an already-resolved analysis. */
function isLiveAnalysis(value: CommentAnalysis | LiveAnalysis): value is LiveAnalysis {
  return (
    typeof value === 'object' &&
    value !== null &&
    'current' in value &&
    typeof (value as LiveAnalysis).current === 'object'
  );
}

/**
 * Append a rainbow button to a comment container. Clicking it opens the modal
 * with the comment's analysis. Repeated calls are a no-op so the button is
 * only ever rendered once. Accepts either a resolved `CommentAnalysis` or a
 * `LiveAnalysis` holder whose `.current` is read lazily at click time (used
 * for optimistic renders before async inference resolves).
 *
 * When `heartButtonSelector` is provided and matches an element within the
 * container, the rainbow button is inserted immediately after that element
 * (beneath the comment's heart/like button on Instagram, next to Reply in
 * YouTube's like/dislike/Reply action row) instead of being appended to the
 * end of the comment container. The lookup pierces open shadow roots (where
 * YouTube renders its action toolbar), so comma-separated fallback selectors
 * are tried in order until one matches. If no anchor is found, the button
 * gracefully falls back to being appended to the container.
 */
export function renderCommentControls(options: CommentControlsOptions): void {
  const { container, comment, analysis, doc, windowRef, heartButtonSelector } =
    options;
  if (container.dataset?.['noh8RainbowButton'] === 'true') return;

  const markRendered = (): void => {
    if (container.setAttribute) container.setAttribute('data-noh8-controls', 'true');
    if (container.dataset) container.dataset['noh8RainbowButton'] = 'true';
  };

  const button = createRainbowButton(doc, comment, analysis, windowRef);

  // Place the button inline in the action row (16px, transparent) when it is
  // anchored next to Reply/Like, so it sits in the same line; standalone
  // fallback buttons keep the 28px rainbow-disc styling from creation.
  const inlineActionStyle = (): void => {
    if (button.style) {
      button.style.width = '16px';
      button.style.height = '16px';
      button.style.fontSize = '14px';
      button.style.background = 'transparent';
      button.style.boxShadow = 'none';
      button.style.margin = '0 0 0 8px';
    }
  };

  if (heartButtonSelector) {
    // Try each comma-separated anchor in order so fallbacks (toolbar,
    // action-buttons) still match when the primary (Reply) node is renamed.
    // `queryOne` pierces open shadow roots — YouTube's toolbar is invisible
    // to host-level `querySelector`, which is why buttons vanished there.
    const parts = heartButtonSelector
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const part of parts) {
      let heart: UiElement | null = null;
      try {
        heart = queryOne(container, part);
      } catch {
        continue;
      }
      if (!heart) continue;
      // When the anchor is a row container (#toolbar,
      // ytd-comment-action-buttons-renderer), append the button inside it
      // (end of the Like/Dislike/Reply line); when it is a single action
      // button (Reply, Instagram heart) insert directly after it.
      const isRowContainer =
        typeof heart.appendChild === 'function' &&
        /toolbar|action-buttons/i.test(part);
      try {
        if (isRowContainer && !/reply-button/i.test(part)) {
          if (typeof heart.appendChild !== 'function') continue;
          heart.appendChild(button);
        } else {
          const anchorParent = heart.parentNode ?? null;
          if (anchorParent && typeof anchorParent.insertBefore === 'function') {
            anchorParent.insertBefore(button, heart.nextSibling ?? null);
          } else if (typeof heart.appendChild === 'function') {
            heart.appendChild(button);
          } else {
            continue;
          }
        }
        inlineActionStyle();
        markRendered();
        // Expose the live analysis holder on the button so the content
        // script's optimistic render can swap in the resolved analysis.
        attachLiveHolder(button, analysis);
        return;
      } catch {
        continue;
      }
    }
    // No anchor matched — fall through to the default append path below.
  }

  // Default: append to the comment container.
  try {
    container.appendChild?.(button);
    markRendered();
    attachLiveHolder(button, analysis);
  } catch {
    // Leave unmarked so a later scan can retry the render.
  }
}

/** Stash the LiveAnalysis holder on the button for later in-place updates. */
function attachLiveHolder(button: UiElement, analysis: unknown): void {
  if (isLiveAnalysisLike(analysis)) {
    liveHolderStore.set(button, analysis);
  }
}

/** Structural check for a LiveAnalysis holder without unsafe casts. */
function isLiveAnalysisLike(value: unknown): value is LiveAnalysis {
  if (typeof value !== 'object' || value === null) return false;
  if (!('current' in value)) return false;
  const current = (value as { current?: unknown }).current;
  return typeof current === 'object' && current !== null;
}

/** Side-table for optimistic holders (avoids expanding the UiElement seam). */
const liveHolderStore = new WeakMap<UiElement, LiveAnalysis>();

/**
 * Swap the live analysis holder's value after async inference resolves, so a
 * click on an optimistically rendered button opens the real result. No-op
 * when the button was rendered with a plain (already resolved) analysis.
 */
export function updateRainbowAnalysis(
  button: UiElement,
  analysis: CommentAnalysis
): void {
  const holder = liveHolderStore.get(button);
  if (holder) holder.current = analysis;
}