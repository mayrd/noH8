import { describe, test, expect } from 'vitest';
import {
  RESULT_VALUES,
  BROWSER_VALUES,
  createResultKey,
  validateResultEntry,
  summarizeResults,
  entryToDocRow,
  type VerificationResultEntry,
} from '../../scripts/verificationLog.mjs';
import { VERIFICATION_MATRIX } from '../../scripts/platformVerification.mjs';

/**
 * L1 (ledger) — machine-readable live-verification results.
 *
 * The L1 harness prints a blank checklist and audits that
 * `docs/PLATFORM_VERIFICATION.md` mentions every matrix row, but there is no
 * schema for recording a live run (date/browser/version/result/drift) and no
 * validator that rejects malformed entries. This suite defines that seam
 * (RED first per the strict TDD protocol).
 */

function validEntry(overrides: Partial<VerificationResultEntry> = {}): VerificationResultEntry {
  return {
    rowId: 'comments-primary',
    target: 'youtube',
    browser: 'chrome',
    version: 'Chrome 128',
    date: '2026-09-14',
    result: 'pass',
    driftNotes: '',
    ...overrides,
  };
}

describe('verification results ledger (L1)', () => {
  test('exposes the closed result + browser vocabularies', () => {
    expect([...RESULT_VALUES].sort()).toEqual(['fail', 'pass', 'pending']);
    expect([...BROWSER_VALUES].sort()).toEqual(['chrome', 'firefox']);
  });

  test('createResultKey is stable and unique per row/target/browser', () => {
    expect(createResultKey(validEntry())).toBe('comments-primary:youtube:chrome');
    expect(createResultKey(validEntry({ browser: 'firefox' }))).toBe(
      'comments-primary:youtube:firefox',
    );
    expect(createResultKey(validEntry())).not.toBe(
      createResultKey(validEntry({ target: 'tiktok' })),
    );
  });

  test('validateResultEntry accepts a well-formed live entry', () => {
    expect(validateResultEntry(validEntry())).toEqual([]);
  });

  test('validateResultEntry rejects unknown row/target/browser/result values', () => {
    const errors = validateResultEntry(
      validEntry({
        rowId: 'no-such-row',
        target: 'myspace',
        browser: 'safari',
        result: 'maybe',
      } as unknown as VerificationResultEntry),
      VERIFICATION_MATRIX,
    );
    expect(errors.length).toBeGreaterThanOrEqual(3);
    expect(errors.join(' ')).toMatch(/rowId|target|browser|result/);
  });

  test('validateResultEntry rejects cross-platform target/browser mismatch', () => {
    // `firefox-package` only exists for firefox — a chrome entry is invalid.
    const errors = validateResultEntry(
      validEntry({ rowId: 'firefox-package', target: 'firefox', browser: 'chrome' }),
      VERIFICATION_MATRIX,
    );
    expect(errors.some((e) => e.includes('firefox-package'))).toBe(true);
  });

  test('validateResultEntry requires date + version once a cell leaves pending', () => {
    const errors = validateResultEntry(validEntry({ date: '', version: '' }));
    expect(errors.some((e) => e.includes('date'))).toBe(true);
    expect(errors.some((e) => e.includes('version'))).toBe(true);
    // Pending rows may leave protocol fields blank.
    expect(validateResultEntry(validEntry({ result: 'pending', date: '', version: '' }))).toEqual(
      [],
    );
  });

  test('validateResultEntry rejects malformed ISO dates', () => {
    const errors = validateResultEntry(validEntry({ date: '14/09/2026' }));
    expect(errors.some((e) => e.includes('date'))).toBe(true);
  });

  test('summarizeResults counts pending/pass/fail over the full matrix', () => {
    const summary = summarizeResults([], VERIFICATION_MATRIX);
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.pending).toBe(summary.total);
    expect(summary.pass).toBe(0);
    expect(summary.fail).toBe(0);
  });

  test('summarizeResults tallies recorded entries by key', () => {
    const summary = summarizeResults(
      [validEntry(), validEntry({ rowId: 'comments-secondary', target: 'youtube', result: 'fail' })],
      VERIFICATION_MATRIX,
    );
    expect(summary.pass).toBe(1);
    expect(summary.fail).toBe(1);
    expect(summary.pending).toBe(summary.total - 2);
  });

  test('entryToDocRow renders a pipe-safe markdown row for the doc table', () => {
    const row = entryToDocRow(validEntry({ driftNotes: 'primary | secondary drift' }));
    expect(row).toContain('comments-primary');
    expect(row).toContain('pass');
    // Embedded pipes must not break the markdown table.
    expect(row.split('|').length).toBeGreaterThan(9);
    expect(row).not.toContain('primary | secondary');
  });
});
