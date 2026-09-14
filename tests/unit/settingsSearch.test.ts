import { describe, test, expect } from 'vitest';
import {
  filterSettingsSections,
  matchesSection,
  normalizeSearchQuery,
  type SearchableSection,
} from '../../src/settings/settingsSearch';

const SECTIONS: SearchableSection[] = [
  {
    id: 'platforms',
    title: 'Platforms',
    description: 'Turn on the social platforms you want NoH8 to scan',
    keywords: 'youtube instagram facebook tiktok scanning origins',
  },
  {
    id: 'handling',
    title: 'Comment Handling',
    description: 'Review your own comment drafts before you post them',
    keywords: 'drafts review harmful language',
  },
  {
    id: 'models',
    title: 'Detection Model',
    description: 'The machine-learning model used to analyse comments on-device',
    keywords: 'download refresh delete hugging face consensus',
  },
];

describe('settingsSearch (M19)', () => {
  test('normalizeSearchQuery lowercases, trims, and strips diacritics', () => {
    expect(normalizeSearchQuery('  Modèle ')).toBe('modele');
    expect(normalizeSearchQuery('DRAFTS')).toBe('drafts');
  });

  test('empty query returns all sections', () => {
    expect(filterSettingsSections(SECTIONS, '')).toEqual(SECTIONS);
    expect(filterSettingsSections(SECTIONS, '   ')).toEqual(SECTIONS);
  });

  test('matches a section by title', () => {
    expect(matchesSection(SECTIONS[0], normalizeSearchQuery('platforms'))).toBe(true);
    expect(matchesSection(SECTIONS[1], normalizeSearchQuery('platforms'))).toBe(false);
  });

  test('matches a section by description or keyword', () => {
    expect(filterSettingsSections(SECTIONS, 'drafts').map((s) => s.id)).toEqual(['handling']);
    expect(filterSettingsSections(SECTIONS, 'youtube').map((s) => s.id)).toEqual(['platforms']);
    expect(filterSettingsSections(SECTIONS, 'consensus').map((s) => s.id)).toEqual(['models']);
  });

  test('matches across diacritics (modele finds model)', () => {
    const withAccent: SearchableSection[] = [
      { id: 'models', title: 'Modèle de détection', description: '', keywords: '' },
    ];
    expect(filterSettingsSections(withAccent, 'modele')).toHaveLength(1);
  });

  test('no-match query returns an empty list', () => {
    expect(filterSettingsSections(SECTIONS, 'zzz-no-such-setting')).toEqual([]);
  });

  test('matching is case-insensitive', () => {
    expect(filterSettingsSections(SECTIONS, 'PLATFORMS').map((s) => s.id)).toEqual(['platforms']);
  });
});
