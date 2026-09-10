import { describe, test, expect, afterEach } from 'vitest';
import {
  t,
  setLocale,
  getLocale,
  resolveLocale,
  MESSAGES,
  type MessageKey,
} from '../../src/shared/i18n';

afterEach(() => {
  setLocale('en');
  delete (globalThis as Record<string, unknown>)['chrome'];
});

describe('i18n catalog (M15)', () => {
  test('every catalog entry maps to a non-empty en string', () => {
    for (const [key, value] of Object.entries(MESSAGES.en)) {
      expect((value as string).trim().length, `key: ${key}`).toBeGreaterThan(0);
    }
  });

  test('t() returns the en string for a simple key', () => {
    expect(t('modal.close')).toBe('Close analysis');
  });

  test('t() interpolates {param} placeholders', () => {
    expect(t('modal.flagged', { percent: 90 })).toBe('⚠ Flagged — 90% confidence.');
  });

  test('t() interpolates multiple params', () => {
    const result = t('rainbowButton.label', { author: 'tester' });
    expect(result).toBe('View NoH8 analysis for comment by tester');
  });

  test('missing params are left as-is rather than rendering "undefined"', () => {
    expect(t('modal.flagged')).toContain('{percent}');
  });

  test('unknown key returns the key itself', () => {
    expect(t('bogus.key' as MessageKey)).toBe('bogus.key');
  });

  test('an unknown locale falls back to en', () => {
    setLocale('zz');
    expect(getLocale()).toBe('en');
    expect(t('modal.close')).toBe(MESSAGES.en['modal.close']);
  });

  test('resolveLocale prefers chrome.i18n.getUILanguage when its base has a catalog', () => {
    (globalThis as Record<string, unknown>)['chrome'] = {
      i18n: { getUILanguage: () => 'en-GB' },
    };
    expect(resolveLocale()).toBe('en');
  });

  test('resolveLocale falls back to en when chrome.i18n is unavailable', () => {
    expect(resolveLocale()).toBe('en');
  });

  test('resolveLocale falls back to en for languages with no catalog', () => {
    (globalThis as Record<string, unknown>)['chrome'] = {
      i18n: { getUILanguage: () => 'xx-LOL' },
    };
    expect(resolveLocale()).toBe('en');
  });
});

// --- L2: reporting-flow keys ------------------------------------------------

describe('reporting-flow catalog keys (L2)', () => {
  test('evidence snippet keys interpolate their params', () => {
    expect(t('report.snippet.header', { platform: 'YouTube' })).toContain('YouTube');
    expect(t('report.snippet.author', { author: 'tester_user' })).toContain('tester_user');
    expect(t('report.snippet.score', { percent: 92 })).toContain('92%');
    expect(t('report.snippet.scoreClean', { percent: 10 })).toContain('not flagged');
    expect(t('report.snippet.comment', { text: 'some comment' })).toContain('some comment');
  });

  test('copy status keys are non-empty', () => {
    expect(t('modal.report.copied').length).toBeGreaterThan(0);
    expect(t('modal.report.copyFailed').length).toBeGreaterThan(0);
    expect(t('sidepanel.reportCopied').length).toBeGreaterThan(0);
    expect(t('sidepanel.reportCopyFailed').length).toBeGreaterThan(0);
  });
});
