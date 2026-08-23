import type { CommentData } from '../../shared/types';
import { openAnalysisModal } from './analysisModal';
import {
  RAINBOW_GRADIENT,
  type DraftReviewOptions,
  type UiElement,
} from './uiTypes';

/** Apply inline CSS values to a UI element. */
function styles(el: UiElement, values: Record<string, string>): void {
  if (el.style) Object.assign(el.style, values);
}

/**
 * Append a rainbow "review draft" button next to a comment-composer textarea
 * (or contenteditable element). Clicking it reads the current draft text, runs
 * it through the on-device analyser, and opens the same analysis modal used for
 * existing comments so the user can review their draft before posting.
 *
 * Repeated calls on the same textarea are a no-op so the button is only ever
 * rendered once.
 */
export function renderDraftReviewButton(options: DraftReviewOptions): void {
  const { textarea, platform, doc, windowRef, author = 'You', analyze } = options;

  // Idempotency: skip if this textarea was already decorated.
  if (textarea.dataset?.['noh8DraftButton'] === 'true') return;
  if (textarea.setAttribute) textarea.setAttribute('data-noh8-draft', 'true');
  if (textarea.dataset) textarea.dataset['noh8DraftButton'] = 'true';

  const button = doc.createElement('button');
  button.setAttribute?.('data-noh8-draft-rainbow', 'true');
  button.setAttribute?.('type', 'button');
  button.setAttribute?.(
    'aria-label',
    `Review this comment draft with NoH8 (${author})`
  );
  if (button.dataset) button.dataset['noh8DraftRainbow'] = 'true';
  button.textContent = '🌈';

  styles(button, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    margin: '2px 0 2px 6px',
    padding: '0',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '16px',
    background: `linear-gradient(135deg, ${RAINBOW_GRADIENT})`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
    verticalAlign: 'middle',
  });

  // Place the rainbow button immediately after the textarea (as a sibling).
  const parent = textarea.parentNode;
  if (parent && typeof parent.insertBefore === 'function') {
    parent.insertBefore(button, textarea.nextSibling ?? null);
  } else if (typeof textarea.appendChild === 'function') {
    // No parent to insert into — nest inside the textarea element.
    textarea.appendChild(button);
  }

  button.addEventListener?.('click', async () => {
    // Read the current draft text: real <textarea> uses `.value`, while
    // contenteditable elements expose their content via `.textContent`.
    const text = (textarea.value ?? textarea.textContent ?? '').trim();
    const draftId = `draft-${platform}`;
    const analysis = await analyze({ id: draftId, text });

    const comment: CommentData = {
      id: draftId,
      platform: platform as CommentData['platform'],
      author,
      text,
    };

    openAnalysisModal({ doc, comment, analysis, windowRef });
  });
}
