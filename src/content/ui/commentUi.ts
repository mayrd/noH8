import type { CommentAnalysis, CommentData } from '../../shared/types';

/**
 * Per-comment UI — a rainbow "analyze" button behind each comment and a small
 * modal that explains how the comment was scored before opening Instagram's
 * report flow.
 *
 * Uses the same lightweight structural-DOM approach as the platform adapters:
 * real `Element` / `Document` / `Window` instances satisfy these interfaces
 * structurally, but the module can be unit tested in Node without jsdom.
 */

export interface UiElement {
  textContent: string | null;
  appendChild?(node: UiElement): void;
  setAttribute?(name: string, value: string): void;
  addEventListener?(type: string, listener: (event?: unknown) => void): void;
  style?: Record<string, string>;
  dataset?: Record<string, string>;
  remove?(): void;
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
}

export interface ModalOptions {
  doc: UiDocument;
  comment: CommentData;
  analysis: CommentAnalysis;
  windowRef?: UiWindow;
}

/**
 * Destination for the modal's "Report on Instagram" action.
 *
 * NOTE: Instagram does not expose a stable public deep-link that pre-fills the
 * comment-report form, so we point the user at Instagram's report gate. When a
 * stable report URL becomes available this function is the single place to
 * update it.
 */
export function buildCommentReportUrl(_comment: Pick<CommentData, 'id'>): string {
  return 'https://www.instagram.com/report/';
}

const RAINBOW_GRADIENT = [
  '#ff0000',
  '#ff8000',
  '#ffff00',
  '#00ff00',
  '#00f0ff',
  '#4000ff',
  '#a000ff',
].join(', ');

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
 */
export function openAnalysisModal(options: ModalOptions): UiElement {
  const { doc, comment, analysis, windowRef } = options;

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
  title.textContent = '🌈 NoH8 Comment Analysis';
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
  closeBtn.setAttribute?.('aria-label', 'Close analysis');
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
  closeBtn.addEventListener?.('click', () => overlay.remove?.());
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
  section('How sentiment is scored');
  const scorePercent = Math.round(((analysis.sentiment.score + 1) / 2) * 100);
  const sentimentLine = doc.createElement('div');
  sentimentLine.textContent = `${analysis.sentiment.label} · local score ${scorePercent}% on a scale of -1 (very negative) to +1 (very positive).`;
  append(card, sentimentLine);
  const scoredBy = doc.createElement('div');
  scoredBy.textContent =
    'Sentiment is estimated entirely on-device from the balance of positive and negative words in the comment. Nothing is sent to a server.';
  styles(scoredBy, { color: '#666', fontSize: '13px', marginTop: '4px' });
  append(card, scoredBy);

  // Hate speech status
  section('Hate speech detection');
  const hateLine = doc.createElement('div');
  const hatePercent = Math.round(analysis.hateSpeechScore * 100);
  hateLine.textContent = analysis.isHateSpeech
    ? `⚠ Flagged — ${hatePercent}% confidence.`
    : `Not flagged (${hatePercent}% confidence).`;
  styles(hateLine, {
    color: analysis.isHateSpeech ? '#b00020' : '#1a7f37',
    fontWeight: '600',
  });
  append(card, hateLine);

  // Detected issues
  section('Detected issues');
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
      rowTitle.textContent = `• ${detected.label}`;
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
    none.textContent = 'No hate speech or other issues detected.';
    styles(none, { color: '#1a7f37' });
    append(card, none);
  }

  // Report action — opens Instagram's report flow in a new tab.
  const reportBtn = doc.createElement('button');
  reportBtn.textContent = 'Report on Instagram';
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
    windowRef?.open(buildCommentReportUrl(comment), '_blank');
  });
  append(card, reportBtn);

  // Privacy note
  const note = doc.createElement('div');
  note.textContent =
    'This analysis ran 100% locally in your browser. For context on the sensitive words involved, tap Report on Instagram.';
  styles(note, { color: '#888', fontSize: '12px', marginTop: '10px' });
  append(card, note);

  // Close when clicking the backdrop.
  overlay.addEventListener?.('click', (event) => {
    const target = event as { target?: UiElement };
    if (target && target.target === overlay) overlay.remove?.();
  });

  append(doc.body, overlay);
  return overlay;
}

/**
 * Append a rainbow button to a comment container. Clicking it opens the modal
 * with the comment's analysis. Repeated calls are a no-op so the button is
 * only ever rendered once.
 */
export function renderCommentControls(options: CommentControlsOptions): void {
  const { container, comment, analysis, doc, windowRef } = options;
  if (container.dataset?.['noh8RainbowButton'] === 'true') return;

  if (container.setAttribute) container.setAttribute('data-noh8-controls', 'true');
  if (container.dataset) container.dataset['noh8RainbowButton'] = 'true';

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

  container.appendChild?.(button);
}