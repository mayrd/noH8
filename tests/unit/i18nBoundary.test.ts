import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * M15 — i18n boundary architecture test.
 *
 * All user-facing strings in the UI surfaces must flow through the shared
 * i18n catalog (`src/shared/i18n.ts`), and the injected content-script UI
 * must not hard-code English literals in the DOM.
 */

const ROOT = join(__dirname, '..', '..', 'src');

const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

describe('i18n boundary', () => {
  test('every injected content-ui module imports the shared i18n seam', () => {
    const dir = join(ROOT, 'content', 'ui');
    const files = readdirSync(dir).filter(
      (name) => name.endsWith('.ts') && name !== 'uiTypes.ts' && name !== 'motion.ts'
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = read(join('content', 'ui', file));
      expect(
        /from\s+'(.*shared\/i18n|.*reportHelper)'/.test(source) ||
          /from\s+'(.*commentUi|.*analysisModal)'/.test(source),
        `${file} should route strings through shared/i18n`
      ).toBe(true);
    }
  });

  test('content-ui modules assign no raw user-facing text to textContent', () => {
    const dir = join(ROOT, 'content', 'ui');
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts'));
    for (const file of files) {
      const source = read(join('content', 'ui', file));
      // `textContent = '<literal>'` with ASCII letters is hard-coded English;
      // catalog-driven assignment (`textContent = t(...)`) is the only path.
      const offenders = [...source.matchAll(/textContent\s*=\s*(['"`])([^'"`\n]*)\1/g)]
        .map((match) => match[2])
        .filter((value) => /[a-zA-Z]{2,}/.test(value));
      expect(offenders, `${file} hard-codes English text: ${offenders.join(', ')}`).toEqual([]);
    }
  });

  test('sidepanel and settings surfaces import the shared i18n seam', () => {
    const surfaces = [
      'sidepanel/Sidepanel.tsx',
      'settings/SettingsPage.tsx',
      'settings/SettingsPopup.tsx',
      'settings/Welcome.tsx',
      'settings/ModelManager.tsx',
    ];
    for (const file of surfaces) {
      expect(/shared\/i18n/.test(read(file)), `${file} should import shared/i18n`).toBe(
        true
      );
    }
  });
});
