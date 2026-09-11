import type { CommentData } from '../../shared/types';
import { t } from '../../shared/i18n';
import { injectRainbowMotionStyles } from './motion';
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
 * Render the transient i18n "nothing to review" note under an empty composer
 * (L3). Exactly one note ever exists per composer: a second empty review
 * refreshes the text instead of stacking duplicates.
 */
function showEmptyDraftNote(options: {
  textarea: UiElement;
  doc: DraftReviewOptions['doc'];
}): UiElement | null {
  const { textarea, doc } = options;
  const parent = textarea.parentNode;
  const anchor = parent ?? textarea;
  const existing = anchor.querySelector?.('[data-noh8-draft-empty]') ?? null;
  if (existing) {
    existing.textContent = t('draftReview.empty');
    return existing;
  }
  const note = doc.createElement('div');
  note.setAttribute?.('data-noh8-draft-empty', 'true');
  if (note.dataset) note.dataset['noh8DraftEmpty'] = 'true';
  note.textContent = t('draftReview.empty');
  styles(note, {
    color: '#555',
    fontSize: '12px',
    marginTop: '4px',
  });
  if (parent && typeof parent.insertBefore === 'function') {
    parent.insertBefore(note, textarea.nextSibling ?? null);
  } else {
    anchor.appendChild?.(note);
  }
  return note;
}

/** Remove any transient empty-draft note next to the composer (L3). */
function clearEmptyDraftNote(textarea: UiElement): void {
  const anchor = textarea.parentNode ?? textarea;
  anchor.querySelector?.('[data-noh8-draft-empty]')?.remove?.();
}

/**
 * Reflect the latest draft verdict on the review button (L3 pre-post warning
 * state): a flagged draft is marked `data-noh8-draft-flagged` + `aria-pressed`
 * with an updated label, and returns to the default label once re-analysed as
 * clean. Screen-reader users learn the verdict without opening the modal.
 */
function setDraftFlaggedState(button: UiElement, author: string, flagged: boolean): void {
  if (button.dataset) button.dataset['noh8DraftFlagged'] = flagged ? 'true' : 'false';
  button.setAttribute?.('data-noh8-draft-flagged', flagged ? 'true' : 'false');
  button.setAttribute?.('aria-pressed', flagged ? 'true' : 'false');
  button.setAttribute?.(
    'aria-label',
    flagged ? t('draftReview.flaggedButton', { author }) : t('draftReview.label', { author })
  );
  styles(button, {
    outline: flagged ? '2px solid #b00020' : 'none',
    boxShadow: flagged
      ? '0 0 0 3px rgba(176,0,32,0.35)'
      : '0 1px 3px rgba(0,0,0,0.25)',
  });
}

/**
 * Append a rainbow "review draft" button next to a comment-composer textarea
 * (or contenteditable element). Clicking it reads the current draft text, runs
 * it through the on-device analyser, and opens the same analysis modal used for
 * existing comments so the user can review their draft before posting.
 *
 * Repeated calls on the same textarea are a no-op so the button is only ever
 * rendered once.
 *
 * L3 behaviour:
 * - an empty composer shows the i18n "nothing to review" note instead of
 *   analysing an empty string (no inference call);
 * - a flagged analysis marks the review button ("draft flagged") and the modal
 *   carries a pre-post warning banner, until the text is re-analysed as clean.
 */
export function renderDraftReviewButton(options: DraftReviewOptions): void {
  const { textarea, platform, doc, windowRef, author = 'You', analyze } = options;

  // Idempotency: skip if this textarea was already decorated.
  if (textarea.dataset?.['noh8DraftButton'] === 'true') return;
  if (textarea.setAttribute) textarea.setAttribute('data-noh8-draft', 'true');
  if (textarea.dataset) textarea.dataset['noh8DraftButton'] = 'true';

  const button = doc.createElement('button');
  injectRainbowMotionStyles(doc);
  button.setAttribute?.('data-noh8-draft-rainbow', 'true');
  button.setAttribute?.('type', 'button');
  button.setAttribute?.(
    'aria-label',
    t('draftReview.label', { author })
  );
  // L3: expose the pre-post warning state to assistive tech.
  button.setAttribute?.('aria-pressed', 'false');
  button.setAttribute?.('class', 'noh8-rainbow-animated');
  if (button.dataset) {
    button.dataset['noh8DraftRainbow'] = 'true';
    button.dataset['noh8DraftFlagged'] = 'false';
  }
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
    // L3: an empty composer shows the i18n "nothing to review" note instead
    // of analysing an empty string (no inference call, no modal).
    if (!text) {
      showEmptyDraftNote({ textarea, doc });
      return;
    }
    clearEmptyDraftNote(textarea);

    const draftId = `draft-${platform}`;
    const analysis = await analyze({ id: draftId, text });

    // L3: the review button reflects "draft flagged" until the text is
    // re-analysed as clean.
    setDraftFlaggedState(button, author, analysis.isHateSpeech);

    const comment: CommentData = {
      id: draftId,
      platform: platform as CommentData['platform'],
      author,
      text,
    };

    openAnalysisModal({
      doc,
      comment,
      analysis,
      windowRef,
      trigger: button,
      // L3: a flagged draft carries a pre-post warning banner in the modal.
      draftWarning: analysis.isHateSpeech ? t('draftReview.flaggedTitle') : undefined,
    });
  });
}
