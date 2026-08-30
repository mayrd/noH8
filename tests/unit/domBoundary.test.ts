import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  asUiDocument,
  asUiElement,
  asUiWindow,
} from '../../src/shared/domBridge';

/**
 * Architecture guard for the DOM boundary (AGENTS.md §5 debt item):
 *
 * The structural `Ui*` interfaces must never be bridged to/from the real DOM
 * with ad-hoc `as unknown as X` / `as any` casts sprinkled across `src/`.
 * Every crossing must go through `src/shared/domBridge.ts`, the single
 * documented unsafe seam. This test fails if any *other* source file
 * reintroduces a double cast or `any` cast.
 */
const SRC_ROOT = join(process.cwd(), 'src');
/** The one sanctioned home for boundary casts. */
const SANCTIONED_SEAM = join(SRC_ROOT, 'shared', 'domBridge.ts');
const FORBIDDEN = [/as\s+unknown\s+as/, /as\s+any\b/];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('DOM boundary architecture guard', () => {
  it('contains no ad-hoc double casts (`as unknown as`) outside domBridge.ts', () => {
    const offenders: string[] = [];
    for (const file of listTsFiles(SRC_ROOT)) {
      if (file === SANCTIONED_SEAM) continue;
      const src = readFileSync(file, 'utf8');
      if (FORBIDDEN.some((re) => re.test(src))) offenders.push(file);
    }
    expect(
      offenders,
      `Unsanctioned DOM-boundary casts found in:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});

describe('domBridge — the single unsafe DOM seam', () => {
  it('passes elements through unchanged (identity, not copies)', () => {
    const fake = { textContent: 'hi', querySelectorAll: () => [] };
    expect(asUiElement(fake as unknown as Element)).toBe(fake);
  });

  it('passes documents through unchanged', () => {
    const fake = { createElement: () => ({}), body: {} };
    expect(asUiDocument(fake as unknown as Document)).toBe(fake);
  });

  it('passes windows through unchanged', () => {
    const fake = { open: () => undefined };
    expect(asUiWindow(fake as unknown as Window)).toBe(fake);
  });
});
