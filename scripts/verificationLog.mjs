/**
 * L1 — machine-readable live-verification results ledger.
 *
 * `scripts/platformVerification.mjs` is the blank checklist (single source for
 * the §8.5 matrix) and `docs/PLATFORM_VERIFICATION.md` is the human-readable
 * log. This module is the schema *between* them: one closed vocabulary for
 * live-run entries, a pure validator (no DOM, no chrome APIs, no network), a
 * tally helper for progress, and a pipe-safe markdown renderer for doc rows.
 *
 * A live run is recorded per (rowId, target, browser) slot: per-platform rows
 * need one entry per browser (Chrome + Firefox); cross-platform rows carry
 * the browser as their target, so browser must equal target there.
 *
 * @typedef {'pass' | 'fail' | 'pending'} VerificationResult
 * @typedef {'chrome' | 'firefox'} VerificationBrowser
 * @typedef {object} VerificationResultEntry
 * @property {string} rowId - matrix row id (e.g. 'comments-primary').
 * @property {string} target - platform or browser target (e.g. 'youtube').
 * @property {VerificationBrowser} browser - browser the live run used.
 * @property {string} version - browser version label (e.g. 'Chrome 128').
 * @property {string} date - ISO date 'YYYY-MM-DD' (required unless pending).
 * @property {VerificationResult} result - live outcome.
 * @property {string} driftNotes - selector-drift notes (may be empty).
 */

export const RESULT_VALUES = ['pass', 'fail', 'pending'];
export const BROWSER_VALUES = ['chrome', 'firefox'];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Stable ledger key for one live-verification slot.
 * @param {VerificationResultEntry} entry
 * @returns {string} `rowId:target:browser`.
 */
export function createResultKey(entry) {
  return `${entry.rowId}:${entry.target}:${entry.browser}`;
}

/**
 * Validate one ledger entry against the matrix (pure, no I/O).
 * @param {VerificationResultEntry} entry
 * @param {Array<{ id: string, flow: string, cells: Array<{ target: string }> }>} [matrix]
 * @returns {string[]} human-readable errors; empty means valid.
 */
export function validateResultEntry(entry, matrix = null) {
  const errors = [];
  if (!entry || typeof entry !== 'object') return ['entry must be an object'];
  if (!RESULT_VALUES.includes(entry.result)) {
    errors.push(`unknown result '${entry.result}' (expected one of ${RESULT_VALUES.join('/')})`);
  }
  if (!BROWSER_VALUES.includes(entry.browser)) {
    errors.push(`unknown browser '${entry.browser}' (expected one of ${BROWSER_VALUES.join('/')})`);
  }
  if (matrix) {
    const row = matrix.find((r) => r.id === entry.rowId);
    if (!row) {
      errors.push(`unknown rowId '${entry.rowId}' (not in the verification matrix)`);
    } else {
      const cellTargets = row.cells.map((c) => c.target);
      if (!cellTargets.includes(entry.target)) {
        errors.push(
          `unknown target '${entry.target}' for row '${entry.rowId}' (expected one of ${cellTargets.join('/')})`,
        );
      }
      if (row.flow === 'cross-platform' && cellTargets.includes(entry.target)) {
        if (entry.browser !== entry.target) {
          errors.push(
            `row '${entry.rowId}' is cross-platform: browser '${entry.browser}' must equal target '${entry.target}'`,
          );
        }
      }
    }
  } else if (typeof entry.rowId !== 'string' || entry.rowId.length === 0) {
    errors.push('rowId must be a non-empty string');
  }
  if (entry.result !== 'pending') {
    if (typeof entry.date !== 'string' || entry.date.length === 0) {
      errors.push('date is required once a cell leaves pending (ISO YYYY-MM-DD)');
    }
    if (typeof entry.version !== 'string' || entry.version.length === 0) {
      errors.push('version is required once a cell leaves pending (e.g. Chrome 128)');
    }
  }
  if (typeof entry.date === 'string' && entry.date.length > 0 && !ISO_DATE_RE.test(entry.date)) {
    errors.push(`malformed date '${entry.date}' (expected ISO YYYY-MM-DD)`);
  }
  return errors;
}

/**
 * Expand the matrix into every (rowId, target, browser) slot key.
 * @param {Array<{ id: string, flow: string, cells: Array<{ target: string }> }>} matrix
 * @returns {string[]} expected ledger keys.
 */
export function expandExpectedKeys(matrix) {
  const keys = [];
  for (const row of matrix) {
    for (const cell of row.cells) {
      if (row.flow === 'cross-platform') {
        keys.push(`${row.id}:${cell.target}:${cell.target}`);
      } else {
        for (const browser of BROWSER_VALUES) keys.push(`${row.id}:${cell.target}:${browser}`);
      }
    }
  }
  return keys;
}

/**
 * Tally recorded entries against the full matrix (last entry wins per key).
 * @param {VerificationResultEntry[]} entries
 * @param {Array<{ id: string, flow: string, cells: Array<{ target: string }> }>} matrix
 * @returns {{ total: number, pass: number, fail: number, pending: number }}
 */
export function summarizeResults(entries, matrix) {
  const expected = expandExpectedKeys(matrix);
  const byKey = new Map();
  for (const entry of entries) byKey.set(createResultKey(entry), entry.result);
  let pass = 0;
  let fail = 0;
  for (const key of expected) {
    const result = byKey.get(key);
    if (result === 'pass') pass += 1;
    else if (result === 'fail') fail += 1;
  }
  return { total: expected.length, pass, fail, pending: expected.length - pass - fail };
}

/**
 * Render one ledger entry as a pipe-safe markdown table row.
 * @param {VerificationResultEntry} entry
 * @returns {string} markdown row with 8 cells (pipes in free text escaped).
 */
export function entryToDocRow(entry) {
  const safe = (value) => String(value ?? '').replaceAll('|', '/').trim();
  const key = createResultKey(entry);
  return `| ${safe(entry.rowId)} | ${safe(entry.target)} | ${safe(entry.browser)} | ${safe(entry.version)} | ${safe(entry.date)} | ${safe(entry.result)} | ${safe(entry.driftNotes)} | ${safe(key)} |`;
}
