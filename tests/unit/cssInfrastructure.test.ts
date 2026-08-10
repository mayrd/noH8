import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());

/**
 * The settings UI relies on Tailwind CSS utility classes. These tests verify the
 * Tailwind pipeline is actually wired up — without it every `bg-gray-50` /
 * `rounded-lg` / `border` class is dead and the page renders as unstyled HTML.
 */
describe('Tailwind CSS infrastructure', () => {
  test('src/index.css entry point exists', () => {
    expect(existsSync(resolve(ROOT, 'src/index.css'))).toBe(true);
  });

  test('src/index.css includes the three Tailwind directives', () => {
    const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8');
    expect(css).toContain('@tailwind base');
    expect(css).toContain('@tailwind components');
    expect(css).toContain('@tailwind utilities');
  });

  test('tailwind.config.js exists', () => {
    expect(
      existsSync(resolve(ROOT, 'tailwind.config.js')) ||
        existsSync(resolve(ROOT, 'tailwind.config.cjs')) ||
        existsSync(resolve(ROOT, 'tailwind.config.mjs'))
    ).toBe(true);
  });

  test('settings entry point imports the CSS file', () => {
    const main = readFileSync(resolve(ROOT, 'src/settings/main.tsx'), 'utf8');
    expect(main).toMatch(/import\s+['"].*index\.css['"]/);
  });

  test('popup entry point imports the CSS file', () => {
    const popup = readFileSync(resolve(ROOT, 'src/settings/popup.tsx'), 'utf8');
    expect(popup).toMatch(/import\s+['"].*index\.css['"]/);
  });
});
