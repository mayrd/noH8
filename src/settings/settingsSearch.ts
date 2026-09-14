/**
 * Settings search helper (M19 — settings search & keyboard shortcuts).
 *
 * Pure, client-side filter over the settings page sections. Matching runs
 * against section titles, descriptions, and keyword hints derived from the
 * existing `src/shared/i18n.ts` catalog — no network, no storage, no DOM.
 */

/** A settings page section that filter-as-you-type search can match. */
export interface SearchableSection {
  /** Stable section id (e.g. 'platforms', 'handling', 'models'). */
  id: string;
  /** Visible section heading. */
  title: string;
  /** Visible section description. */
  description: string;
  /** Extra match hints (model names, action labels, …). */
  keywords: string;
}

/**
 * Normalize a raw search query for matching: trim, lowercase, and strip
 * diacritics so `modele` still finds `modèle`.
 */
export function normalizeSearchQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Whether a single section matches an already-normalized query.
 * An empty query matches everything (no filtering active).
 */
export function matchesSection(section: SearchableSection, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) return true;
  const haystack = normalizeSearchQuery(
    `${section.title} ${section.description} ${section.keywords}`
  );
  return haystack.includes(normalizedQuery);
}

/**
 * Filter sections by a raw user query (case-insensitive, diacritics-aware).
 * Returns the original array contents for an empty/blank query.
 */
export function filterSettingsSections(
  sections: SearchableSection[],
  query: string
): SearchableSection[] {
  const normalized = normalizeSearchQuery(query);
  if (normalized.length === 0) return sections;
  return sections.filter((section) => matchesSection(section, normalized));
}
