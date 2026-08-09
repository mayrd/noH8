import { describe, test, expect } from 'vitest';
import {
  PLATFORM_CONFIGS,
  getMatchesForPlatform,
  getAllMatches,
} from '../../src/content/platformConfig';

const EXPECTED_INSTAGRAM_MATCHES = [
  'https://www.instagram.com/*',
  'https://m.instagram.com/*',
  'https://instagram.com/*',
];

describe('PlatformConfig', () => {
  test('defines a config entry for every supported platform', () => {
    expect(Object.keys(PLATFORM_CONFIGS).sort()).toEqual([
      'facebook',
      'instagram',
      'tiktok',
      'youtube',
    ]);
  });

  test('instagram config includes the domains that should be parsed in the browser', () => {
    expect(getMatchesForPlatform('instagram')).toEqual(EXPECTED_INSTAGRAM_MATCHES);
    expect(PLATFORM_CONFIGS.instagram.matches).toContain('https://www.instagram.com/*');
  });

  test('youtube config is scoped to youtube hosts only', () => {
    expect(getMatchesForPlatform('youtube')).toEqual([
      'https://www.youtube.com/*',
      'https://m.youtube.com/*',
    ]);
  });

  test('getAllMatches flattens the matches across every platform', () => {
    const all = getAllMatches();
    expect(all).toContain('https://www.instagram.com/*');
    expect(all).toContain('https://www.facebook.com/*');
    expect(all).toContain('https://www.tiktok.com/*');
  });
});