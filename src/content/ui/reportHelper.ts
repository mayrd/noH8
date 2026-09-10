import type { CommentData } from '../../shared/types';
import type { UiDocument } from '../../shared/uiTypes';
import { t } from '../../shared/i18n';

/**
 * The platforms that ship a real on-device adapter. Kept in sync with
 * `shared/types.ts` (`CommentData['platform']`) and `platformConfig.ts`.
 */
export type ReportPlatform = 'youtube' | 'instagram' | 'facebook' | 'tiktok';

/** Where to point the user's "Report on <Platform>" button, per platform. */
export interface PlatformReportTarget {
  /** Destination URL for the report button. */
  url: string;
}

/**
 * Per-platform report destinations.
 *
 * None of these platforms expose a stable public deep-link that can
 * pre-fill a *specific comment* into a report form, so we point the user at the
 * platform's official reporting / policy / "report a problem" entry point —
 * mirroring the approach the original Instagram NOTE took. When a stable
 * comment-level report link ships on a platform, update `url` here.
 */
export const PLATFORM_REPORT_TARGETS: Record<ReportPlatform, PlatformReportTarget> = {
  youtube: {
    url: 'https://support.google.com/youtube/answer/2801973',
  },
  instagram: {
    url: 'https://www.instagram.com/report/',
  },
  facebook: {
    url: 'https://www.facebook.com/help/contact/153231014864064',
  },
  tiktok: {
    url: 'https://www.tiktok.com/legal/page/tiktok-policy',
  },
};

/**
 * Build the report destination URL for a flagged comment.
 *
 * The `comment` is accepted (and used for future deep-links) but, because no
 * platform currently exposes a stable comment-level report URL, the result
 * depends only on the comment's `platform`.
 */
export function buildReportUrl(
  platform: ReportPlatform,
  _comment: Pick<CommentData, 'id' | 'platform'>
): string {
  const target = PLATFORM_REPORT_TARGETS[platform];
  // Defensive fallback if the platform set ever drifts.
  if (!target) return `https://www.${platform}.com`;
  return target.url;
}

/** Human-readable, properly-cased name for a platform. */
export const PLATFORM_LABELS: Record<ReportPlatform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

/** Human-readable label for the report button, e.g. "Report on YouTube". */
export function reportActionLabel(platform: ReportPlatform): string {
  return t('report.action', { platform: PLATFORM_LABELS[platform] });
}

// ---------------------------------------------------------------------------
// L2 — reporting flow hardening
// ---------------------------------------------------------------------------

/** Minimal analysis shape needed for the evidence snippet. */
export interface ReportEvidence {
  isHateSpeech: boolean;
  hateSpeechScore: number;
}

/** Thin injectable clipboard seam (no new permissions). */
export interface ClipboardSeam {
  writeText(text: string): Promise<void>;
}

/** Injectable dependencies for the report flow. */
export interface ReportDeps {
  /** Clipboard seam; defaults to `navigator.clipboard` when available. */
  clipboard?: ClipboardSeam;
  /** Full opener override (e.g. the sidepanel's `chrome.tabs.create`). */
  openTab?: (url: string) => void;
  /**
   * Document used to open the report URL via a temporary
   * `target="_blank" rel="noopener noreferrer"` anchor (content-script path).
   */
  doc?: UiDocument;
  /** Fallback opener when neither `openTab` nor `doc` is provided. */
  windowRef?: { open(url: string, target?: string, features?: string): void };
}

/** Result of a report action. */
export interface ReportOutcome {
  /** Whether the evidence snippet reached the clipboard. */
  copied: boolean;
  /** The report destination URL that was opened. */
  url: string;
}

/**
 * Build the structured evidence snippet copied to the clipboard before the
 * report flow navigates away: comment text, author, platform and NoH8 score.
 * Pure and i18n-driven.
 */
export function buildReportSnippet(
  comment: Pick<CommentData, 'author' | 'platform' | 'text'>,
  evidence: ReportEvidence
): string {
  const percent = Math.round(evidence.hateSpeechScore * 100);
  const score = evidence.isHateSpeech
    ? t('report.snippet.score', { percent })
    : t('report.snippet.scoreClean', { percent });
  return [
    t('report.snippet.header', { platform: PLATFORM_LABELS[comment.platform] }),
    t('report.snippet.author', { author: comment.author }),
    score,
    t('report.snippet.comment', { text: comment.text }),
    '',
    '— NoH8 (100% on-device analysis)',
  ].join('\n');
}

/**
 * Copy the evidence snippet through the injectable clipboard seam. Resolves
 * `false` (never throws) when no seam is available or the write is rejected.
 */
export async function copyReportSnippet(
  snippet: string,
  clipboard?: ClipboardSeam
): Promise<boolean> {
  if (!clipboard || typeof clipboard.writeText !== 'function') return false;
  try {
    await clipboard.writeText(snippet);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open `url` in a new tab via a temporary anchor carrying
 * `target="_blank" rel="noopener noreferrer"` (popup/side-channel safe and
 * `window.opener`-proof). The anchor is removed immediately after activation.
 */
export function openReportAnchor(url: string, doc: UiDocument): void {
  const anchor = doc.createElement('a');
  anchor.setAttribute?.('href', url);
  anchor.setAttribute?.('target', '_blank');
  anchor.setAttribute?.('rel', 'noopener noreferrer');
  doc.body.appendChild?.(anchor);
  anchor.click?.();
  anchor.remove?.();
}

/**
 * Run the full report flow for a comment (L2): copy the structured evidence
 * snippet to the clipboard first, then open the platform report URL in a new
 * tab. The URL derives solely from the persisted `platform` field, so the
 * flow works even after the comment element has left the DOM.
 */
export async function reportComment(
  comment: CommentData,
  evidence: ReportEvidence,
  deps: ReportDeps = {}
): Promise<ReportOutcome> {
  const url = buildReportUrl(comment.platform, comment);
  const snippet = buildReportSnippet(comment, evidence);

  const clipboard =
    deps.clipboard ??
    ((globalThis as { navigator?: { clipboard?: ClipboardSeam } }).navigator?.clipboard);
  const copied = await copyReportSnippet(snippet, clipboard);

  if (deps.openTab) {
    deps.openTab(url);
  } else if (deps.doc) {
    openReportAnchor(url, deps.doc);
  } else {
    deps.windowRef?.open(url, '_blank', 'noopener,noreferrer');
  }
  return { copied, url };
}
