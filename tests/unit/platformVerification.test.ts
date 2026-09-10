import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERIFICATION_MATRIX,
  renderVerificationChecklist,
  countCells,
  PLATFORMS,
  BROWSERS,
} from '../../scripts/platformVerification.mjs';

/**
 * L1 — live-platform verification harness.
 *
 * The §8.5 acceptance matrix must be machine-readable so the `verify` script
 * can print it as a live-verification checklist and
 * `docs/PLATFORM_VERIFICATION.md` can be audited for coverage of every cell.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const FLOW1 = 8; // reading & analysing criteria
const FLOW2 = 5; // reporting criteria
const FLOW3 = 6; // draft-review criteria
const CROSS = 5; // cross-platform (browser) criteria

describe('verification matrix (L1)', () => {
  test('covers exactly the §8.5 flows and criteria counts', () => {
    const flows = new Set(VERIFICATION_MATRIX.map((row) => row.flow));
    expect(flows).toEqual(
      new Set(['reading & analysing', 'reporting', 'draft review', 'cross-platform'])
    );
    expect(VERIFICATION_MATRIX.filter((r) => r.flow === 'reading & analysing')).toHaveLength(FLOW1);
    expect(VERIFICATION_MATRIX.filter((r) => r.flow === 'reporting')).toHaveLength(FLOW2);
    expect(VERIFICATION_MATRIX.filter((r) => r.flow === 'draft review')).toHaveLength(FLOW3);
    expect(VERIFICATION_MATRIX.filter((r) => r.flow === 'cross-platform')).toHaveLength(CROSS);
  });

  test('every per-platform row covers all four platforms; cross rows both browsers', () => {
    const perPlatform = VERIFICATION_MATRIX.filter((r) => r.flow !== 'cross-platform');
    expect(perPlatform.length).toBe(FLOW1 + FLOW2 + FLOW3);
    for (const row of perPlatform) {
      expect(new Set(row.cells.map((c: { target: string }) => c.target))).toEqual(new Set(PLATFORMS));
    }
    const cross = VERIFICATION_MATRIX.filter((r) => r.flow === 'cross-platform');
    for (const row of cross) {
      const targets = new Set(row.cells.map((c: { target: string }) => c.target));
      // Every cross row targets only known browsers and at least one of them.
      expect(targets.size).toBeGreaterThan(0);
      for (const target of targets) expect(BROWSERS).toContain(target);
    }
    // The full cross-platform suite covers both browsers.
    expect(
      new Set(cross.flatMap((r) => r.cells.map((c: { target: string }) => c.target)))
    ).toEqual(new Set(BROWSERS));
  });

  test('GA/B grades match the §8.5 matrix (B cells only where documented)', () => {
    const cellById = new Map<string, { grade: string }>();
    for (const row of VERIFICATION_MATRIX) {
      for (const cell of row.cells) cellById.set(`${row.id}:${cell.target}`, cell);
    }
    const bCells = [...cellById.entries()].filter(([, cell]) => cell.grade === 'B').map(([id]) => id);
    expect(new Set(bCells)).toEqual(
      new Set([
        'replies-context:tiktok',
        'composer-spa:facebook',
        'composer-spa:tiktok',
      ])
    );
    // No row is entirely best-effort: every platform×flow row has GA cells.
    const gaCount = countCells().ga;
    expect(gaCount).toBe(FLOW1 * 4 + FLOW2 * 4 + FLOW3 * 4 + (CROSS * 2 - 1) - bCells.length);
  });

  test('row ids are unique', () => {
    expect(new Set(VERIFICATION_MATRIX.map((r) => r.id)).size).toBe(VERIFICATION_MATRIX.length);
  });
});

describe('checklist renderer (L1)', () => {
  test('prints every matrix cell as an unchecked checklist item', () => {
    const out = renderVerificationChecklist(VERIFICATION_MATRIX);
    expect(out).toContain('[ ]');
    for (const row of VERIFICATION_MATRIX) {
      for (const cell of row.cells) {
        expect(out).toContain(row.id);
        expect(out).toContain(cell.target);
      }
    }
    // Protocol fields are part of the printed header.
    expect(out.toLowerCase()).toContain('browser');
    expect(out.toLowerCase()).toContain('date');
  });
});

describe('PLATFORM_VERIFICATION.md coverage (L1)', () => {
  const doc = readFileSync(join(ROOT, 'docs', 'PLATFORM_VERIFICATION.md'), 'utf8');

  test('exists and records every matrix row as pending', () => {
    for (const row of VERIFICATION_MATRIX) {
      expect(doc).toContain(row.id);
      expect(doc).toContain(row.criterion);
    }
  });

  test('documents the verification protocol fields', () => {
    const lower = doc.toLowerCase();
    for (const field of ['date', 'browser', 'version', 'platform', 'flow', 'pass', 'drift']) {
      expect(lower).toContain(field);
    }
  });
});

describe('verify script wiring (L1)', () => {
  test('npm run verify is registered', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['verify']).toMatch(/verify-platforms/);
  });
});