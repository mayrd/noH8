import { getEnabledAdapters } from './adapters/registry';
import { initSettingsStore, settingsStore } from '../settings/settingsStore';
import type { Platform } from '../settings/types';

const PLATFORMS: Platform[] = ['youtube', 'instagram', 'facebook', 'tiktok'];

/**
 * Content script entry point.
 *
 * Reads the enabled platforms from the settings store, then boots every
 * matching platform adapter so it can start observing comments on the page.
 */
function start(): void {
  const { enabledPlatforms } = settingsStore.getState();
  const enabled = PLATFORMS.filter((platform) => enabledPlatforms[platform]);

  getEnabledAdapters(enabled)
    .then((adapters) => {
      console.info(
        `[NoH8] monitoring ${adapters.length} platform(s): ${adapters
          .map((adapter) => adapter.platformName)
          .join(', ')}`
      );

      for (const adapter of adapters) {
        adapter.observe((comments) => {
          for (const comment of comments) {
            console.info(`[NoH8][${adapter.platformName}] comment by ${comment.author}: ${comment.text}`);
          }
        });
      }
    })
    .catch((error) => {
      console.error('[NoH8] failed to initialise platform adapters:', error);
    });
}

// Hydrate persisted settings (falls back to defaults when unavailable),
// then start monitoring the page.
initSettingsStore().finally(start);