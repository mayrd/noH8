import type { CommentData } from '../../shared/types';
import { t } from '../../shared/i18n';
import {
  buildReportUrl,
  reportActionLabel,
  reportComment,
  type ClipboardSeam,
} from './reportHelper';
import {
  RAINBOW_GRADIENT,
  type ModalOptions,
  type UiDocument,
  type UiElement,
} from './uiTypes';

/**
 * Destination for the modal's "Report on <Platform>" action.
 *
 * Delegates to the per-platform `buildReportUrl` helper in `reportHelper.ts`.
 */
export function buildCommentReportUrl(
  comment: Pick<CommentData, 'id' | 'platform'>
): string {
  return buildReportUrl(comment.platform, comment);
}

/**
 * Close a modal overlay and return keyboard focus to the element that opened
 * it (M15 accessibility).
 */
export function closeModal(overlay: UiElement, trigger?: UiElement): void {
  overlay.remove?.();
  if (trigger?.focus) trigger.focus();
}

/** Append a styled child element to a parent. */
function append(parent: UiElement, child: UiElement): void {
  parent.appendChild?.(child);
}

/** Apply inline CSS values to a UI element. */
function styles(el: UiElement, values: Record<string, string>): void {
  if (el.style) Object.assign(el.style, values);
}

/**
 * Build the modal overlay that explains a comment's analysis. Returns the
 * overlay so callers/tests can keep a reference to it.
 *
 * Accessibility (M15): the card is `role="dialog"` + `aria-modal`, receives
 * keyboard focus when opened, `Escape` closes it, and focus returns to the
 * `trigger` on any close path.
 */
export function openAnalysisModal(options: ModalOptions): UiElement {
  const { doc, comment, analysis, windowRef, trigger, clipboard } = options;

  const overlay = doc.createElement('div');
  overlay.setAttribute?.('data-noh8-modal-overlay', 'true');
  if (overlay.dataset) overlay.dataset['noh8ModalOverlay'] = 'true';
  styles(overlay, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483000',
    background: 'rgba(20, 20, 20, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  });

  const card = doc.createElement('div');
  card.setAttribute?.('data-noh8-modal', 'true');
  if (card.dataset) card.dataset['noh8Modal'] = 'true';
  card.setAttribute?.('role', 'dialog');
  card.setAttribute?.('aria-modal', 'true');
  card.setAttribute?.('aria-label', t('modal.ariaLabel'));
  card.setAttribute?.('tabindex', '-1');
  styles(card, {
    position: 'relative',
    maxWidth: '420px',
    width: '100%',
    maxHeight: '80vh',
    overflowY: 'auto',
    background: '#ffffff',
    color: '#1a1a1a',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
    textAlign: 'left',
    fontSize: '14px',
    lineHeight: '1.5',
  });

  append(overlay, card);

  // Header row
  const header = doc.createElement('div');
  styles(header, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '12px',
  });

  const title = doc.createElement('span');
  title.textContent = t('modal.title');
  styles(title, {
    fontWeight: '700',
    fontSize: '16px',
    backgroundImage: `linear-gradient(90deg, ${RAINBOW_GRADIENT})`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  });
  append(header, title);

  const closeBtn = doc.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.setAttribute?.('type', 'button');
  closeBtn.setAttribute?.('aria-label', t('modal.close'));
  if (closeBtn.dataset) closeBtn.dataset['noh8Close'] = 'true';
  styles(closeBtn, {
    border: 'none',
    background: '#f1f1f1',
    borderRadius: '999px',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    fontWeight: '700',
    color: '#333',
  });
  closeBtn.addEventListener?.('click', () => closeModal(overlay, trigger));
  append(header, closeBtn);
  append(card, header);

  // Section heading helper
  const section = (heading: string): void => {
    const h = doc.createElement('div');
    h.textContent = heading;
    styles(h, {
      fontWeight: '600',
      fontSize: '13px',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: '#555',
      margin: '14px 0 6px',
    });
    append(card, h);
  };

  // How sentiment is scored
  section(t('modal.section.sentiment'));
  const scorePercent = Math.round(((analysis.sentiment.score + 1) / 2) * 100);
  const sentimentLine = doc.createElement('div');
  sentimentLine.textContent = t('modal.sentiment.line', {
    label: analysis.sentiment.label,
    percent: scorePercent,
  });
  append(card, sentimentLine);
  const scoredBy = doc.createElement('div');
  scoredBy.textContent = t('modal.sentiment.privacy');
  styles(scoredBy, { color: '#666', fontSize: '13px', marginTop: '4px' });
  append(card, scoredBy);

  // Hate speech status
  section(t('modal.section.hate'));
  const hateLine = doc.createElement('div');
  const hatePercent = Math.round(analysis.hateSpeechScore * 100);
  hateLine.textContent = analysis.isHateSpeech
    ? t('modal.flagged', { percent: hatePercent })
    : t('modal.notFlagged', { percent: hatePercent });
  styles(hateLine, {
    color: analysis.isHateSpeech ? '#b00020' : '#1a7f37',
    fontWeight: '600',
  });
  append(card, hateLine);

  // Detected issues
  section(t('modal.section.issues'));
  if (analysis.issues.length > 0) {
    for (const detected of analysis.issues) {
      const row = doc.createElement('div');
      styles(row, {
        background: '#fff4f4',
        border: '1px solid #ffd7d7',
        borderRadius: '10px',
        padding: '8px 10px',
        marginBottom: '6px',
      });
      const rowTitle = doc.createElement('div');
      rowTitle.textContent = t('modal.issue.bullet', { label: detected.label });
      styles(rowTitle, { fontWeight: '600', color: '#b00020' });
      append(row, rowTitle);
      const rowDesc = doc.createElement('div');
      rowDesc.textContent = detected.description;
      styles(rowDesc, { color: '#555', fontSize: '13px' });
      append(row, rowDesc);
      append(card, row);
    }
  } else {
    const none = doc.createElement('div');
    none.textContent = t('modal.noIssues');
    styles(none, { color: '#1a7f37' });
    append(card, none);
  }

  // Report action — opens the platform's report flow in a new tab.
  const reportBtn = doc.createElement('button');
  reportBtn.textContent = reportActionLabel(comment.platform);
  reportBtn.setAttribute?.('type', 'button');
  if (reportBtn.dataset) reportBtn.dataset['noh8Report'] = 'true';
  styles(reportBtn, {
    display: 'block',
    width: '100%',
    marginTop: '16px',
    padding: '11px 14px',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    color: '#ffffff',
    background: 'linear-gradient(90deg, #f4287d, #9b59b6)',
  });
  reportBtn.addEventListener?.('click', () => {
    // (L2) Copy the structured evidence snippet to the clipboard first, then
    // open the platform report URL in a new tab via a popup-safe anchor.
    void reportComment(comment, analysis, { doc, clipboard }).then(
      (outcome) => {
        status.textContent = t(
          outcome.copied ? 'modal.report.copied' : 'modal.report.copyFailed'
        );
      }
    );
  });
  append(card, reportBtn);

  // (L2) Copy status feedback line, filled in asynchronously by the handler.
  const status = doc.createElement('div');
  styles(status, { color: '#1a7f37', fontSize: '12px', marginTop: '8px', minHeight: '14px' });
  append(card, status);

  // Privacy note
  const note = doc.createElement('div');
  note.textContent = t('modal.privacy.note', {
    report: reportActionLabel(comment.platform).toLowerCase(),
  });
  styles(note, { color: '#888', fontSize: '12px', marginTop: '10px' });
  append(card, note);

  // Close when clicking the backdrop.
  overlay.addEventListener?.('click', (event) => {
    const target = event as { target?: UiElement };
    if (target && target.target === overlay) closeModal(overlay, trigger);
  });

  // Keyboard path: Escape closes the modal (M15 accessibility). The card
  // receives focus when opened so the keydown event reaches the overlay.
  overlay.addEventListener?.('keydown', (event) => {
    const key = (event as { key?: string } | undefined)?.key;
    if (key === 'Escape') closeModal(overlay, trigger);
  });

  append(doc.body, overlay);
  card.focus?.();
  return overlay;
}
