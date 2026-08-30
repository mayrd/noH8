import type { FlaggedComment } from './flagStore';

/**
 * Build a portable JSON export of flagged comments. This is the user's data:
 * it never leaves the device unless the user explicitly saves/shares the
 * downloaded file, and internal DOM references are stripped from the payload.
 */
export function exportFlagsToJson(comments: FlaggedComment[]): string {
  const sorted = [...comments].sort((a, b) => b.timestamp - a.timestamp);
  const payload = {
    exportedAt: new Date().toISOString(),
    count: sorted.length,
    comments: sorted.map((c) => ({
      id: c.id,
      commentId: c.commentId,
      platform: c.platform,
      author: c.author,
      text: c.text,
      url: c.url,
      timestamp: c.timestamp,
      sentiment: c.sentiment,
      isHateSpeech: c.isHateSpeech,
      hateSpeechScore: c.hateSpeechScore,
      issues: c.issues,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Filename for a flag export download, e.g. `noh8-flags-2026-08-30.json`.
 */
export function flagsExportFileName(date: Date = new Date()): string {
  const iso = date.toISOString().slice(0, 10);
  return `noh8-flags-${iso}.json`;
}
