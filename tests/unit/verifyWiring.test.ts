import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERIFICATION_MATRIX, renderVerificationChecklist } from '../../scripts/platformVerification.mjs';
import { expandExpectedKeys, BROWSER_VALUES } from '../../scripts/verificationLog.mjs';

/**
 * L1 (verify wiring) — the `npm run verify` checklist must tell the verifier
 * *exactly* which (row, target, browser) slots to record via the ledger seam
 * (`scripts/verificationLog.mjs`), so a live run is trackable per browser and
 * per-platform work is not conflated with cross-platform browser targets.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('verify/ledger wiring (L1)', () => {
  test('checklist references the verificationLog ledger seam', () => {
    const out = renderVerificationChecklist(VERIFICATION_MATRIX);
    expect(out).toContain('verificationLog.mjs');
  });

  test('checklist prints one item per (row, target, browser) slot', () => {
    const out = renderVerificationChecklist(VERIFICATION_MATRIX);
    const expected = expandExpectedKeys(VERIFICATION_MATRIX);
    // Per-platform rows expect both browsers; cross-platform rows pin browser=target.
    for (const key of expected) {
      const [rowId, target, browser] = key.split(':');
      expect(BROWSER_VALUES).toContain(browser);
      expect(out).toContain(`${rowId}:${target}:${browser}`);
    }
    const counted = (out.match(/^- \[ \] /gm) ?? []).length;
    expect(counted).toBe(expected.length);
  });

  test('verify script still only prints (no network, no side effects)', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'verify-platforms.mjs'), 'utf8');
    expect(src).toMatch(/process\.stdout\.write/);
    expect(src).not.toMatch(/fetch\(|XMLHttpRequest|chrome\./);
  });
});
