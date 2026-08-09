import type { Platform } from '../settings/types';

/**
 * Per-platform URL configuration.
 *
 * `matches` are Chrome/Firefox match patterns that describe the domains/pages
 * an adapter should parse when opened in the browser. They are used to:
 *  - scope the manifest `content_scripts`, `host_permissions` and
 *    `optional_host_permissions` to exactly these pages, and
 *  - power the runtime `chrome.permissions.request()` flow so the extension
 *    asks the user for permission to parse a platform's pages.
 */
export interface PlatformConfig {
  platform: Platform;
  /** Host match patterns for the pages this platform's adapter should parse. */
  matches: string[];
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  youtube: {
    platform: 'youtube',
    matches: ['https://www.youtube.com/*', 'https://m.youtube.com/*'],
  },
  instagram: {
    platform: 'instagram',
    matches: [
      'https://www.instagram.com/*',
      'https://m.instagram.com/*',
      'https://instagram.com/*',
    ],
  },
  facebook: {
    platform: 'facebook',
    matches: ['https://www.facebook.com/*', 'https://m.facebook.com/*'],
  },
  tiktok: {
    platform: 'tiktok',
    matches: ['https://www.tiktok.com/*', 'https://m.tiktok.com/*'],
  },
};

/** The order in which platforms are listed in the manifest / UI. */
export const PLATFORM_NAMES: Platform[] = Object.keys(PLATFORM_CONFIGS) as Platform[];

/** Return the host match patterns for a single platform. */
export function getMatchesForPlatform(platform: Platform): string[] {
  return PLATFORM_CONFIGS[platform].matches;
}

/**
 * Flatten the host match patterns for every enabled platform (defaults to all
 * supported platforms). Used to build the manifest's `content_scripts`,
 * `host_permissions` and `optional_host_permissions`.
 */
export function getAllMatches(platforms: Platform[] = PLATFORM_NAMES): string[] {
  const unique = new Set<string>();
  for (const platform of platforms) {
    if (!PLATFORM_CONFIGS[platform]) continue;
    for (const match of PLATFORM_CONFIGS[platform].matches) {
      unique.add(match);
    }
  }
  return Array.from(unique);
}