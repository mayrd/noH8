import React, { useMemo, useState } from 'react';
import { useSettingsStore } from '../settings/settingsStore';
import { getMatchesForPlatform } from '../content/platformConfig';
import ModelManager from './ModelManager';
import SettingsGuide from './SettingsGuide';
import { PLATFORM_META } from './platformMeta';
import { resetLearnedCalibration } from '../offscreen/calibration';
import { t } from '../shared/i18n';
import { filterSettingsSections, type SearchableSection } from './settingsSearch';
import type { Platform } from '../settings/types';

const SettingsPage: React.FC = () => {
  const {
    enabledPlatforms,
    setEnabledPlatform,
    resetToDefaults,
    reviewOwnCommentDrafts,
    setReviewOwnCommentDrafts,
  } = useSettingsStore();

  const handleToggle = (platform: Platform, checked: boolean) => {
    setEnabledPlatform(platform, checked);
  };

  const handleReset = () => {
    if (
      confirm(
        t('settings.reset.confirm')
      )
    ) {
      resetToDefaults();
    }
  };

  /**
   * M13: clear the locally-learned threshold calibration (derived from the
   * user's false-positive dismissals). The dismissal history itself is kept.
   */
  const handleResetCalibration = () => {
    if (
      confirm(
        t('settings.resetCalibration.confirm')
      )
    ) {
      void resetLearnedCalibration();
    }
  };

  const enabledCount = Object.values(enabledPlatforms).filter(Boolean).length;

  // (M19) Keyboard shortcut: pressing `/` focuses the settings search box,
  // `Escape` clears it. Page-local keydown listener only — no manifest
  // `commands`, no new permissions, no chrome API surface.
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() ?? '';
      const typing =
        tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable === true;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  /**
   * M19 — filter-as-you-type search over the settings sections. The match
   * corpus is derived from the existing i18n catalog (section titles +
   * descriptions + platform/model keywords); filtering is pure client-side.
   */
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchableSections: SearchableSection[] = useMemo(
    () => [
      {
        id: 'guide',
        title: t('settings.guide.title'),
        description: t('settings.guide.intro'),
        keywords: 'rainbow button colors flagged how it works welcome guide red green',
      },
      {
        id: 'platforms',
        title: t('settings.section.platforms'),
        description: t('settings.platforms.desc'),
        keywords: 'youtube instagram facebook tiktok scanning origins platforms',
      },
      {
        id: 'handling',
        title: t('settings.section.handling'),
        description: t('settings.handling.desc'),
        keywords: 'drafts review comment handling harmful language',
      },
      {
        id: 'models',
        title: t('models.title'),
        description: t('models.desc'),
        keywords: 'model download refresh delete hugging face consensus detection',
      },
    ],
    []
  );
  const visibleSections = useMemo(
    () => filterSettingsSections(searchableSections, searchQuery),
    [searchableSections, searchQuery]
  );
  const isFiltering = searchQuery.trim().length > 0;
  const showGuide = visibleSections.some((s) => s.id === 'guide');
  const showPlatforms = visibleSections.some((s) => s.id === 'platforms');
  const showHandling = visibleSections.some((s) => s.id === 'handling');
  const showModels = visibleSections.some((s) => s.id === 'models');

  return (
    <div className="w-full min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Page header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('settings.subtitle')}
        </p>
        <p className="text-xs text-gray-400 mt-1">{t('settings.platformsActive', { count: enabledCount })}</p>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-10">
          {/* M19 — filter-as-you-type search over the settings sections */}
          <div role="search">
            <label htmlFor="settings-search" className="sr-only">
              {t('settings.search.label')}
            </label>
            <input
              id="settings-search"
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('settings.search.placeholder')}
              aria-label={t('settings.search.label')}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-noh8-500"
            />
            {isFiltering && visibleSections.length > 0 && (
              <p role="status" className="mt-2 text-xs text-gray-500">
                {t('settings.search.results', {
                  count: visibleSections.length,
                  plural: visibleSections.length !== 1 ? 's' : '',
                })}
              </p>
            )}
          </div>
          {isFiltering && visibleSections.length === 0 && (
            <p role="status" className="text-sm text-gray-500">
              {t('settings.search.noResults', { query: searchQuery.trim() })}
            </p>
          )}
          {/* How-NoH8-works welcome guide: settings page is the welcome screen */}
          {showGuide && <SettingsGuide />}
          {/* Platforms section */}
          {showPlatforms && (
          <section data-testid="platforms-section">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">{t('settings.section.platforms')}</h2>
            <p className="text-sm text-gray-500 mb-4">
              {t('settings.platforms.desc')}
            </p>

            <div className="space-y-3">
              {(Object.keys(PLATFORM_META) as Platform[]).map((platform) => {
                const meta = PLATFORM_META[platform];
                const checked = Boolean(enabledPlatforms[platform]);
                const matches = getMatchesForPlatform(platform);
                return (
                  <div
                    key={platform}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className={meta.color}>{meta.Icon ? <meta.Icon /> : null}</span>
                      <div>
                        <span className="text-sm font-medium text-gray-800 block">
                          {meta.label}
                        </span>
                        <span className="text-xs text-gray-500 block mt-0.5">
                          {t('settings.scansOrigins', {
                            count: matches.length,
                            plural: matches.length !== 1 ? 's' : '',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Toggle switch */}
                    <label
                      className={`relative inline-flex items-center h-6 w-11 rounded-full cursor-pointer transition-colors ${
                        checked ? 'bg-noh8-600' : 'bg-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => handleToggle(platform, e.target.checked)}
                        aria-label={t('settings.toggleScanning', { platform: meta.label })}
                        className="sr-only peer"
                      />
                      <span
                        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          checked ? 'translate-x-5' : ''
                        }`}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {/* Review own comment drafts section */}
          {showHandling && (
          <section data-testid="handling-section">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">{t('settings.section.handling')}</h2>
            <p className="text-sm text-gray-500 mb-4">
              {t('settings.handling.desc')}
            </p>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">{t('settings.reviewDrafts')}</span>
              <label
                className={`relative inline-flex items-center h-6 w-11 rounded-full cursor-pointer transition-colors ${
                  reviewOwnCommentDrafts ? 'bg-noh8-600' : 'bg-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={reviewOwnCommentDrafts}
                  onChange={(e) => setReviewOwnCommentDrafts(e.target.checked)}
                  aria-label={t('settings.reviewDraftsAria')}
                  className="sr-only peer"
                />
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    reviewOwnCommentDrafts ? 'translate-x-5' : ''
                  }`}
                />
              </label>
            </div>
          </section>
          )}

          {/* Model manager section */}
          {showModels && (
          <section data-testid="models-section">
            <ModelManager />
          </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-8 py-4 flex gap-3">
        <button
          onClick={handleReset}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-noh8-500"
        >
          {t('settings.reset')}
        </button>
        <button
          onClick={handleResetCalibration}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-noh8-500"
        >
          {t('settings.resetCalibration')}
        </button>
      </footer>
    </div>
  );
};

export default SettingsPage;
