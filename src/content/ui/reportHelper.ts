import type { CommentData } from '../../shared/types';

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
  return `Report on ${PLATFORM_LABELS[platform]}`;
}
