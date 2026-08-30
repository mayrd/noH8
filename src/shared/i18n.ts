/**
 * Shared i18n seam (M15 — accessibility & internationalization).
 *
 * A single typed message catalog with `en` as the source of truth. All
 * user-facing strings in `content/ui`, `sidepanel`, and `settings` resolve
 * through `t()`. The locale is resolved from `chrome.i18n.getUILanguage()`
 * (no new permissions) with an `en` fallback; this is a pure-TS catalog —
 * the manifest `default_locale`/`_locales` mechanism is deliberately NOT used
 * so there is exactly one seam.
 *
 * Placeholders use `{name}` syntax and are interpolated by `t(key, params)`.
 * Missing params are left as-is rather than rendering "undefined".
 */

/** The English catalog — the single source of truth for message keys. */
export const en = {
  // Injected rainbow buttons (content/ui)
  'rainbowButton.label': 'View NoH8 analysis for comment by {author}',
  'draftReview.label': 'Review this comment draft with NoH8 ({author})',
  'report.action': 'Report on {platform}',

  // Analysis modal (content/ui/analysisModal.ts)
  'modal.title': '🌈 NoH8 Comment Analysis',
  'modal.ariaLabel': 'NoH8 comment analysis',
  'modal.close': 'Close analysis',
  'modal.section.sentiment': 'How sentiment is scored',
  'modal.sentiment.line':
    '{label} · local score {percent}% on a scale of -1 (very negative) to +1 (very positive).',
  'modal.sentiment.privacy':
    'Sentiment is estimated entirely on-device from the balance of positive and negative words in the comment. Nothing is sent to a server.',
  'modal.section.hate': 'Hate speech detection',
  'modal.flagged': '⚠ Flagged — {percent}% confidence.',
  'modal.notFlagged': 'Not flagged ({percent}% confidence).',
  'modal.section.issues': 'Detected issues',
  'modal.noIssues': 'No hate speech or other issues detected.',
  'modal.issue.bullet': '• {label}',
  'modal.privacy.note':
    'This analysis ran 100% locally in your browser. For context on the sensitive words involved, tap {report}.',

  // Sidepanel dashboard
  'sidepanel.dashboard': 'Dashboard',
  'sidepanel.flaggedCount': '{count} flagged',
  'sidepanel.currentPage': 'Current Page',
  'sidepanel.allPages': 'All Pages ({count})',
  'sidepanel.filterIssues': 'Filter issues',
  'sidepanel.sortComments': 'Sort comments',
  'sidepanel.newest': 'Newest',
  'sidepanel.highestScore': 'Highest Score',
  'sidepanel.noFlagged': 'No flagged comments',
  'sidepanel.emptyPage': 'No hate speech detected on this page yet.',
  'sidepanel.emptyAll': 'Your review list is empty.',
  'sidepanel.setUp': 'Set up NoH8',
  'sidepanel.anonymous': 'Anonymous',
  'sidepanel.jump': 'Jump',
  'sidepanel.dismiss': 'Dismiss',
  'sidepanel.report': 'Report',
  'sidepanel.exportJson': 'Export JSON',
  'sidepanel.clearPage': 'Clear page flags',
  'sidepanel.clearAll': 'Clear all flags',
  'sidepanel.onDevice': '100% on-device',
  'sidepanel.notVisible': 'Not visible on page',
  'sidepanel.tabNotReady': 'Tab not ready',
  'sidepanel.issue.all': 'All Issues',
  'sidepanel.issue.hateSpeech': 'Hate Speech',
  'sidepanel.issue.harassment': 'Harassment',
  'sidepanel.issue.profanity': 'Profanity',
  'sidepanel.issue.negativeTone': 'Negative Tone',

  // Settings page
  'settings.title': 'NoH8 Settings',
  'settings.subtitle':
    'Configure which platforms to scan and manage your on-device detection model.',
  'settings.platformsActive': '{count}/4 platforms active',
  'settings.section.platforms': 'Platforms',
  'settings.platforms.desc':
    "Turn on the social platforms you want NoH8 to scan for hate speech. When enabled for the first time, you'll be asked to grant permission to read those sites.",
  'settings.scansOrigins': 'Scans {count} origin{plural}',
  'settings.toggleScanning': 'Toggle {platform} scanning',
  'settings.section.handling': 'Comment Handling',
  'settings.handling.desc':
    'Optionally review your own comment drafts for harmful language before you post them.',
  'settings.reviewDrafts': 'Review my own comment drafts',
  'settings.reviewDraftsAria': 'Review own comment drafts',
  'settings.reset': 'Reset to Defaults',
  'settings.reset.confirm':
    'Reset all settings to defaults?\n\nThis will restore the default platform selection and model choice.',
  'settings.resetCalibration': 'Reset learned calibration',
  'settings.resetCalibration.confirm':
    'Reset learned calibration?\n\nThis clears the flag-threshold adjustments NoH8 learned from your dismissed false positives. Your dismissal history is kept.',

  // Popup
  'popup.platformsEnabled': '{count}/4 platforms',
  'popup.flaggedComments': 'Flagged Comments',
  'popup.openSettings': 'Open Settings',
  'popup.tagline': 'Privacy-first hate speech detection',

  // Welcome (first-run) flow
  'welcome.title': 'Welcome to NoH8',
  'welcome.intro':
    'NoH8 detects hate speech in social media comments in real time — 100% on your device.',
  'welcome.intro.strong': 'Nothing leaves your browser.',
  'welcome.intro.tail': 'No servers, no accounts, no tracking.',
  'welcome.step1': '1. Choose platforms to protect',
  'welcome.desc.youtube': 'Analyze YouTube comment threads',
  'welcome.desc.instagram': 'Analyze Instagram comments',
  'welcome.desc.facebook': 'Analyze Facebook comments',
  'welcome.desc.tiktok': 'Analyze TikTok comments',
  'welcome.step2': '2. Get the detection model',
  'welcome.model.desc':
    'Downloads once from the Hugging Face Hub, then runs offline on-device. Until it is ready a built-in keyword heuristic keeps analysis working.',
  'welcome.model.ready': '✓ Model is ready',
  'welcome.model.download': 'Download model',
  'welcome.model.downloading': 'Downloading…',
  'welcome.skip': 'Skip',
  'welcome.getStarted': 'Get started',

  // Model manager
  'models.title': 'Detection Model',
  'models.desc':
    'The machine-learning model used to analyse comments. It is downloaded once and runs 100% on-device. Delete models you no longer need to free up space.',
  'models.status.notDownloaded': 'Not downloaded',
  'models.status.downloading': 'Downloading…',
  'models.status.ready': 'Ready on device',
  'models.status.error': 'Download failed',
  'models.mode': 'Mode: {mode}',
  'models.downloadingFromHub': 'Downloading from Hugging Face…',
  'models.download.success': '{name} downloaded successfully and is ready on-device.',
  'models.action.failed': 'Could not {action} "{name}": {error}',
  'models.action.download': 'download',
  'models.action.refresh': 'refresh',
  'models.action.delete': 'delete',
  'models.button.download': 'Download',
  'models.button.refresh': 'Refresh',
  'models.button.delete': 'Delete',
  'models.button.refreshing': 'Refreshing…',
} as const;

/** All available locale catalogs. `en` is the source of truth. */
export const MESSAGES: Record<string, Partial<Record<MessageKey, string>>> = {
  en,
};

/** A message key from the `en` catalog. */
export type MessageKey = keyof typeof en;

let activeLocale = 'en';

/** The current UI locale (always one with a resolvable catalog). */
export function getLocale(): string {
  return activeLocale;
}

/** Switch the active locale. Unknown locales fall back to `en`. */
export function setLocale(locale: string): void {
  activeLocale = locale in MESSAGES ? locale : 'en';
}

/**
 * Resolve the UI locale from the runtime environment: `chrome.i18n`
 * (MV3 extension context, no extra permissions) first, then
 * `navigator.language`. Only locales whose base has a catalog are returned;
 * everything else falls back to `en`.
 */
export function resolveLocale(): string {
  const chromeRef = (globalThis as { chrome?: unknown }).chrome;
  const i18n = chromeRef as { i18n?: { getUILanguage?: () => string } } | undefined;
  const fromChrome =
    typeof i18n?.i18n?.getUILanguage === 'function' ? i18n.i18n.getUILanguage() : null;

  const navigatorRef = (globalThis as { navigator?: { language?: string } }).navigator;
  const raw = fromChrome ?? (typeof navigatorRef?.language === 'string' ? navigatorRef.language : null);
  if (!raw) return 'en';

  const base = raw.split('-')[0]?.toLowerCase() ?? 'en';
  return base in MESSAGES ? base : 'en';
}

/** Interpolate `{param}` placeholders, leaving unknown placeholders intact. */
function interpolate(
  template: string,
  params: Record<string, string | number> | undefined
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

/**
 * Translate a catalog key in the active locale, interpolating `params`.
 * Unknown keys resolve to the key itself; unknown locales resolve to `en`.
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = MESSAGES[activeLocale]?.[key] ?? en[key];
  if (template === undefined) return key;
  return interpolate(template, params);
}
