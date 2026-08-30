import React, { useState } from 'react';
import { useSettingsStore } from './settingsStore';
import { useModelStore } from './modelStore';
import { requestModelCommand } from '../offscreen/client';
import { markOnboarded } from './onboarding';
import { t } from '../shared/i18n';
import type { Platform } from './types';

/**
 * First-run welcome flow (M12).
 *
 * Walks the user through: (1) what NoH8 does + the privacy promise, (2) the
 * per-platform toggles (enabling a platform triggers the optional-permission
 * request inside `settingsStore`), and (3) a first model download via the
 * existing offscreen command path. Both "Get started" and "Skip" persist the
 * `noh8_onboarded` flag so the page never auto-opens again.
 */

const PLATFORMS: Platform[] = ['youtube', 'instagram', 'facebook', 'tiktok'];

const PLATFORM_DESCRIPTIONS: Record<Platform, string> = {
  youtube: t('welcome.desc.youtube'),
  instagram: t('welcome.desc.instagram'),
  facebook: t('welcome.desc.facebook'),
  tiktok: t('welcome.desc.tiktok'),
};

export interface WelcomeProps {
  /** Called after the flag is persisted (completion or skip). */
  onFinish?: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onFinish }) => {
  const { enabledPlatforms, setEnabledPlatform } = useSettingsStore();
  const { selectedModelId, downloadedModels, modelStatus } = useModelStore();
  const [downloadRequested, setDownloadRequested] = useState(false);

  const modelReady =
    downloadedModels.includes(selectedModelId) || modelStatus[selectedModelId] === 'ready';

  const handleToggle = (platform: Platform): void => {
    setEnabledPlatform(platform, !enabledPlatforms[platform]);
  };

  const handleDownload = async (): Promise<void> => {
    setDownloadRequested(true);
    await requestModelCommand('download', selectedModelId);
  };

  const complete = async (): Promise<void> => {
    await markOnboarded();
    onFinish?.();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex items-center justify-center p-6">
      <main className="w-full max-w-xl bg-slate-800/60 border border-slate-700 rounded-2xl p-8 space-y-6">
        <header className="space-y-2 text-center">
          <span className="text-4xl" aria-hidden="true">🌈</span>
          <h1 className="text-2xl font-bold text-white">{t('welcome.title')}</h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            {t('welcome.intro')}{' '}
            <strong className="text-slate-100">{t('welcome.intro.strong')}</strong> {t('welcome.intro.tail')}
          </p>
        </header>

        {/* Step 1 — platforms & permissions */}
        <section aria-labelledby="welcome-platforms" className="space-y-3">
          <h2 id="welcome-platforms" className="text-sm font-semibold text-slate-200">
            {t('welcome.step1')}
          </h2>
          <ul className="space-y-2">
            {PLATFORMS.map((platform) => (
              <li
                key={platform}
                className="flex items-center justify-between bg-slate-900/60 border border-slate-700/70 rounded-lg px-4 py-2.5"
              >
                <label
                  htmlFor={`welcome-platform-${platform}`}
                  className="text-sm capitalize text-slate-200"
                >
                  {platform}
                  <span className="block text-xs text-slate-400">
                    {PLATFORM_DESCRIPTIONS[platform]}
                  </span>
                </label>
                <input
                  id={`welcome-platform-${platform}`}
                  type="checkbox"
                  aria-label={platform}
                  checked={enabledPlatforms[platform]}
                  onChange={() => handleToggle(platform)}
                  className="h-4 w-4 accent-rose-500"
                />
              </li>
            ))}
          </ul>
        </section>

        {/* Step 2 — first model download */}
        <section aria-labelledby="welcome-model" className="space-y-2">
          <h2 id="welcome-model" className="text-sm font-semibold text-slate-200">
            {t('welcome.step2')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('welcome.model.desc')}
          </p>
          {modelReady ? (
            <p className="text-xs font-medium text-emerald-400">{t('welcome.model.ready')}</p>
          ) : (
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloadRequested}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-60 transition"
            >
              {downloadRequested ? t('welcome.model.downloading') : t('welcome.model.download')}
            </button>
          )}
        </section>

        <footer className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => void complete()}
            className="text-sm text-slate-400 hover:text-slate-200 transition"
          >
            {t('welcome.skip')}
          </button>
          <button
            type="button"
            onClick={() => void complete()}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-noh8-600 rounded-lg hover:bg-noh8-700 transition"
          >
            {t('welcome.getStarted')}
          </button>
        </footer>
      </main>
    </div>
  );
};

export default Welcome;