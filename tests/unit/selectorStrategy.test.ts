import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  selectCommentContainers,
  queryAll,
  resetSelectorWarn,
} from '../../src/content/adapters/selectorStrategy';

// --- Minimal DOM fakes (no jsdom required) ---

interface FakeEl {
  querySelectorAll: ReturnType<typeof vi.fn>;
  textContent: string | null;
}

function makeEl(text = ''): FakeEl {
  return {
    querySelectorAll: vi.fn(() => []),
    textContent: text,
  };
}

/**
 * Root whose `querySelectorAll` calls are routed through a selector-aware
 * handler so tests can simulate "primary matches nothing, secondary matches".
 */
function makeRoot(handler: (selector: string) => FakeEl[]): { querySelectorAll: ReturnType<typeof vi.fn> } {
  return {
    querySelectorAll: vi.fn((selector: string) => handler(selector)),
  };
}

describe('selectorStrategy helpers', () => {
  beforeEach(() => {
    resetSelectorWarn();
  });

  test('queryAll returns the nodes matched for a selector', () => {
    const el = makeEl('hi');
    const root = makeRoot((sel) => (sel === '.comment' ? [el] : []));

    const result = queryAll(root, '.comment');

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(el);
  });

  test('selectCommentContainers uses primary selectors when they yield results', () => {
    const el = makeEl('hi');
    const root = makeRoot((sel) => (sel === '.primary' ? [el] : []));

    const result = selectCommentContainers(root, {
      primary: ['.primary'],
      secondary: ['.secondary'],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(el);
  });

  test('selectCommentContainers falls back to secondary selectors when primary yields nothing', () => {
    const el = makeEl('hi');
    const root = makeRoot((sel) => (sel === '.primary' ? [] : sel === '.secondary' ? [el] : []));

    const result = selectCommentContainers(root, {
      primary: ['.primary'],
      secondary: ['.secondary'],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(el);
  });

  test('selectCommentContainers returns [] without throwing when no selector matches', () => {
    const root = makeRoot(() => []);

    const result = selectCommentContainers(root, {
      primary: ['.primary'],
      secondary: ['.secondary'],
    });

    expect(result).toEqual([]);
  });

  test('selectCommentContainers never throws even if querySelectorAll throws', () => {
    const root = {
      querySelectorAll: vi.fn(() => {
        throw new Error('boom');
      }),
    };

    expect(() =>
      selectCommentContainers(root, { primary: ['.primary'], secondary: ['.secondary'] })
    ).not.toThrow();
    expect(selectCommentContainers(root, { primary: ['.primary'], secondary: ['.secondary'] })).toEqual(
      []
    );
  });

  test('selectCommentContainers returns [] for a null root without throwing', () => {
    expect(
      selectCommentContainers(null, { primary: ['.primary'], secondary: ['.secondary'] })
    ).toEqual([]);
  });

  test('warns once when the primary selector yields nothing and a fallback is used', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = makeEl('hi');
    const root = makeRoot((sel) => (sel === '.primary' ? [] : sel === '.secondary' ? [el] : []));

    // First empty-primary scan: primary fails, secondary used -> one warn.
    selectCommentContainers(root, { primary: ['.primary'], secondary: ['.secondary'] });
    // Second empty-primary scan: warn should NOT repeat (one-time).
    selectCommentContainers(root, { primary: ['.primary'], secondary: ['.secondary'] });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  test('does not warn when the primary selector yields results', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = makeEl('hi');
    const root = makeRoot((sel) => (sel === '.primary' ? [el] : []));

    selectCommentContainers(root, { primary: ['.primary'], secondary: ['.secondary'] });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('resetSelectorWarn allows the one-time warning to fire again', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = makeEl('hi');
    const root = makeRoot((sel) => (sel === '.primary' ? [] : sel === '.secondary' ? [el] : []));

    selectCommentContainers(root, { primary: ['.primary'], secondary: ['.secondary'] });
    selectCommentContainers(root, { primary: ['.primary'], secondary: ['.secondary'] });

    resetSelectorWarn();

    selectCommentContainers(root, { primary: ['.primary'], secondary: ['.secondary'] });

    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });
});