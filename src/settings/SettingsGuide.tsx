import React from 'react';
import { t } from '../shared/i18n';

/**
 * "How NoH8 works" welcome guide rendered at the top of the settings page.
 *
 * The settings page doubles as the welcome screen (there is no separate
 * welcome flow), so first-time users need to learn what they will see inside
 * social pages: the rainbow button injected next to each comment and what the
 * red/green verdict colors mean. Purely presentational — all copy comes from
 * the shared i18n catalog.
 */
const SettingsGuide: React.FC = () => {
  return (
    <section data-testid="how-it-works-section" aria-labelledby="how-noh8-works">
      <h2 id="how-noh8-works" className="text-lg font-semibold text-gray-800 mb-1">
        {t('settings.guide.title')}
      </h2>
      <p className="text-sm text-gray-500 mb-4">{t('settings.guide.intro')}</p>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="text-2xl leading-none">
            🌈
          </span>
          <div>
            <h3 className="text-sm font-medium text-gray-800">{t('settings.guide.icon.title')}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{t('settings.guide.icon.desc')}</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-800">{t('settings.guide.verdict.title')}</h3>
          <ul className="mt-1.5 space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-full bg-red-600"
              />
              <span className="text-gray-700">{t('settings.guide.verdict.flagged')}</span>
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-full bg-green-600"
              />
              <span className="text-gray-700">{t('settings.guide.verdict.clean')}</span>
            </li>
          </ul>
          <p className="text-sm text-gray-500 mt-1.5">{t('settings.guide.verdict.issues')}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-800">{t('settings.guide.drafts.title')}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{t('settings.guide.drafts.desc')}</p>
        </div>

        <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          {t('settings.guide.privacy')}
        </p>
      </div>
    </section>
  );
};

export default SettingsGuide;
