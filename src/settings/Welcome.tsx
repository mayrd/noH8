import React, { useState } from 'react';
import { useSettingsStore } from './settingsStore';
import { useModelStore } from './modelStore';
import { requestModelCommand } from '../offscreen/client';
import { findModelDescriptor } from '../offscreen/modelCatalog';
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
  const { enabledPlatforms, setEnabledPlatform, reviewOwnCommentDrafts, setReviewOwnCommentDrafts } =
    useSettingsStore();
  const { selectedModelId, downloadedModels, modelStatus, downloadProgress } = useModelStore();
  const [downloadRequested, setDownloadRequested] = useState(false);

  const selectedModelName = findModelDescriptor(selectedModelId)?.name ?? selectedModelId;

  const modelReady =
    downloadedModels.includes(selectedModelId) || modelStatus[selectedModelId] === 'ready';
  const modelDownloading = modelStatus[selectedModelId] === 'downloading';
  const modelErrored = modelStatus[selectedModelId] === 'error';
  const progressPercent = Math.max(0, Math.min(100, downloadProgress[selectedModelId] ?? 0));

  const handleToggle = (platform: Platform): void => {
    setEnabledPlatform(platform, !enabledPlatforms[platform]);
  };

  const handleDownload = async (): Promise<void> => {
    setDownloadRequested(true);
    try {
      await requestModelCommand('download', selectedModelId);
    } catch {
      // The offscreen pipeline records the `error` status in the model store,
      // which re-enables the button below via the `modelErrored` branch.
    } finally {
      setDownloadRequested(false);
    }
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
          <p className="text-xs font-medium text-slate-200" data-testid="welcome-model-name">
            {t('welcome.model.selected', { name: selectedModelName })}
          </p>
          {modelReady ? (
            <p className="text-xs font-medium text-emerald-400">{t('welcome.model.ready')}</p>
          ) : modelDownloading ? (
            <div className="space-y-2" data-testid="welcome-model-progress">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{t('welcome.model.downloading')}</span>
                <span>{progressPercent}%</span>
              </div>
              <div
                className="h-2 w-full rounded-full bg-slate-700 overflow-hidden"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                  data-testid="welcome-model-progress-bar"
                />
              </div>
              <p className="text-xs text-slate-400" data-testid="welcome-model-safe">
                {t('welcome.model.safeToLeave')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={downloadRequested}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-60 transition"
              >
                {downloadRequested ? t('welcome.model.downloading') : t('welcome.model.download')}
              </button>
              {modelErrored && (
                <p
                  className="text-xs text-rose-400"
                  data-testid="welcome-model-failed"
                  role="alert"
                >
                  {t('welcome.model.failed')}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Step 3 — optional own-draft review toggle */}
        <section aria-labelledby="welcome-drafts" className="space-y-2">
          <h2 id="welcome-drafts" className="text-sm font-semibold text-slate-200">
            {t('welcome.step3')}
          </h2>
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700/70 rounded-lg px-4 py-2.5">
            <label
              htmlFor="welcome-review-drafts"
              className="text-sm text-slate-200"
            >
              {t('settings.reviewDrafts')}
              <span className="block text-xs text-slate-400">{t('welcome.drafts.desc')}</span>
            </label>
            <input
              id="welcome-review-drafts"
              type="checkbox"
              checked={reviewOwnCommentDrafts}
              onChange={(e) => setReviewOwnCommentDrafts(e.target.checked)}
              className="h-4 w-4 accent-rose-500"
            />
          </div>
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