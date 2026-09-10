/**
 * L1 — machine-readable copy of the §8.5 per-platform acceptance-criteria
 * matrix ("the GA gate").
 *
 * Single source consumed by:
 *   - `scripts/verify-platforms.mjs` (`npm run verify`), which prints the
 *     matrix as a live-verification checklist (no network beyond the visited
 *     page itself), and
 *   - `tests/unit/platformVerification.test.ts`, which audits that
 *     `docs/PLATFORM_VERIFICATION.md` records every cell.
 *
 * Every GA cell needs (1) a unit test in the repo AND (2) a live-verification
 * entry in `docs/PLATFORM_VERIFICATION.md` on Chrome and Firefox.
 */

export const PLATFORMS = ['youtube', 'instagram', 'facebook', 'tiktok'];
export const BROWSERS = ['chrome', 'firefox'];

/**
 * One criterion of the §8.5 matrix. `cells` carries one entry per platform
 * (or browser for cross-platform rows) with its required grade:
 * 'GA' = must pass before launch, 'B' = best-effort, ship with a documented
 * caveat (Known-Limitations, L5).
 */
export const VERIFICATION_MATRIX = [
  // --- Flow 1 — reading & analysing comments ---
  {
    id: 'comments-primary',
    flow: 'reading & analysing',
    criterion: 'Comments extracted via primary selectors (text, author, stable id)',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'comments-secondary',
    flow: 'reading & analysing',
    criterion: 'Secondary selectors still extract when primary drifts (selectorStrategy)',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'comments-unmatched',
    flow: 'reading & analysing',
    criterion: 'Unmatched DOM returns [] without throwing; drift logged (console.warn)',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'comments-observer',
    flow: 'reading & analysing',
    criterion:
      'MutationObserver picks up infinite-scroll / thread-expansion additions, deduped by id',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'replies-context',
    flow: 'reading & analysing',
    criterion: 'Reply threads carry parentId/parentText/depth and merge conservatively',
    cells: [
      { target: 'youtube', grade: 'GA' },
      { target: 'instagram', grade: 'GA' },
      { target: 'facebook', grade: 'GA' },
      { target: 'tiktok', grade: 'B' },
    ],
  },
  {
    id: 'analysis-fallback',
    flow: 'reading & analysing',
    criterion:
      'Offscreen-model analysis renders in modal; model-down → heuristic fallback + sidepanel badge',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'rainbow-a11y',
    flow: 'reading & analysing',
    criterion: 'Rainbow button a11y: role, aria-label, keyboard, modal Escape/focus-restore',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'calibration',
    flow: 'reading & analysing',
    criterion: 'Calibration: dismissing a false positive raises that class threshold (resettable)',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },

  // --- Flow 2 — reporting comments ---
  {
    id: 'report-url',
    flow: 'reporting',
    criterion:
      'Modal "Report on <Platform>" opens the correct per-platform URL in a new tab (noopener)',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'report-evidence',
    flow: 'reporting',
    criterion: 'Evidence snippet copied to clipboard before navigation (L2)',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'report-label',
    flow: 'reporting',
    criterion: 'Button label derives from comment.platform (i18n\u2019d, en fallback)',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'report-sidepanel',
    flow: 'reporting',
    criterion: 'Sidepanel card Report action uses the same buildReportUrl mapping',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'report-removed',
    flow: 'reporting',
    criterion:
      'Report works after the comment element is removed from the DOM (URL from persisted platform)',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },

  // --- Flow 3 — reviewing own comment draft (pre-post) ---
  {
    id: 'composer-match',
    flow: 'draft review',
    criterion: 'Composer matched by adapter commentTextareaSelector (textarea OR contenteditable)',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'composer-single',
    flow: 'draft review',
    criterion:
      'Review button rendered once per composer; SPA re-render yields a fresh button, never duplicates',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'draft-read',
    flow: 'draft review',
    criterion:
      'Draft text read correctly (value vs textContent) and analysed through the scheduler',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'draft-empty',
    flow: 'draft review',
    criterion: 'Empty draft → i18n "nothing to review" note, no inference call (L3)',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'draft-flagged',
    flow: 'draft review',
    criterion: 'Flagged draft shows warning state in the modal before posting (L3)',
    cells: PLATFORMS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'composer-spa',
    flow: 'draft review',
    criterion: 'Composer discovery survives SPA navigation via adapter observation (L3)',
    cells: [
      { target: 'youtube', grade: 'GA' },
      { target: 'instagram', grade: 'GA' },
      { target: 'facebook', grade: 'B' },
      { target: 'tiktok', grade: 'B' },
    ],
  },

  // --- Cross-platform (both browsers) ---
  {
    id: 'check-green',
    flow: 'cross-platform',
    criterion: 'npm run check green (typecheck + tests + build)',
    cells: BROWSERS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'firefox-package',
    flow: 'cross-platform',
    criterion: 'npm run package:firefox produces a correct transformed manifest',
    cells: [{ target: 'firefox', grade: 'GA' }],
  },
  {
    id: 'offscreen-relay',
    flow: 'cross-platform',
    criterion: 'Offscreen document created on install; messages relayed with relayed dedup',
    cells: BROWSERS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'permissions-flow',
    flow: 'cross-platform',
    criterion: 'Optional host permissions requested per platform via welcome-flow toggles',
    cells: BROWSERS.map((target) => ({ target, grade: 'GA' })),
  },
  {
    id: 'no-network',
    flow: 'cross-platform',
    criterion:
      'No network beyond Hugging Face model fetch; no chrome.storage.sync for flags/telemetry (architecture guard tests)',
    cells: BROWSERS.map((target) => ({ target, grade: 'GA' })),
  },
];

/** Count GA/B cells across the whole matrix. */
export function countCells(matrix = VERIFICATION_MATRIX) {
  let ga = 0;
  let b = 0;
  for (const row of matrix) {
    for (const cell of row.cells) {
      if (cell.grade === 'B') b += 1;
      else ga += 1;
    }
  }
  return { ga, b };
}

const TARGET_LABELS = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  chrome: 'Chrome',
  firefox: 'Firefox',
};

/**
 * Render the matrix as a markdown checklist for manual live verification.
 * Pure function so the unit suite can audit its output.
 */
export function renderVerificationChecklist(matrix = VERIFICATION_MATRIX) {
  const { ga, b } = countCells(matrix);
  const lines = [
    '# NoH8 — Live Platform Verification Checklist (L1)',
    '',
    'Verify every cell below against the live site on Chrome and Firefox',
    '(as applicable) and record the result in docs/PLATFORM_VERIFICATION.md',
    'with: date, browser, version, platform, flow, pass/fail, drift notes.',
    '',
    `Cells: ${ga} GA · ${b} best-effort (B — ship with a documented caveat).`,
    '',
    'Before verifying a cell, confirm a unit test for that criterion exists',
    'and passes (npm test) — every GA cell needs a repo test AND a live entry.',
    '',
  ];
  let currentFlow = null;
  for (const row of matrix) {
    if (row.flow !== currentFlow) {
      currentFlow = row.flow;
      lines.push(`## ${currentFlow}`, '');
    }
    lines.push(`### ${row.id} — ${row.criterion}`, '');
    for (const cell of row.cells) {
      lines.push(
        `- [ ] ${row.id}:${cell.target} (${TARGET_LABELS[cell.target] ?? cell.target}, ${cell.grade}) — date: ____ · browser: ____ · version: ____ · result: pass/fail · drift notes: ____`
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

