import type { Platform } from './types';

/**
 * First-run onboarding state helpers (M12).
 *
 * The flag lives in `chrome.storage.local` (not `sync`) because it describes the
 * state of *this* browser profile's setup flow. Both "Get started" and "Skip"
 * persist the same flag — the welcome page must not re-open on the next
 * install/update event once the user has seen it.
 */

export const ONBOARDING_STORAGE_KEY = 'noh8_onboarded';

/** Minimal slice of the model store used to decide whether setup is complete. */
export interface OnboardingModelState {
  selectedModelId: string;
  downloadedModels: string[];
  modelStatus: Record<string, string>;
}

function isOnboardedFromStorage(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve(false);
      return;
    }
    chrome.storage.local.get(ONBOARDING_STORAGE_KEY, (result) => {
      resolve(Boolean(result?.[ONBOARDING_STORAGE_KEY]));
    });
  });
}

/** Whether the user has completed (or skipped) the first-run welcome flow. */
export async function isOnboarded(): Promise<boolean> {
  return isOnboardedFromStorage();
}

/**
 * Persist the onboarding flag. Used by both flow completion and "skip" —
 * once seen, the welcome page never auto-opens again.
 */
export async function markOnboarded(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: true }, () => resolve());
  });
}

/**
 * Whether the user still needs the first-run setup: true when no platform is
 * enabled or the selected model has not been downloaded/marked ready.
 */
export function needsOnboarding(
  enabledPlatforms: Record<Platform, boolean>,
  model: OnboardingModelState
): boolean {
  const anyPlatformEnabled = Object.values(enabledPlatforms ?? {}).some(Boolean);
  const modelReady =
    Boolean(model?.selectedModelId) &&
    (model.downloadedModels?.includes(model.selectedModelId) ||
      model.modelStatus?.[model.selectedModelId] === 'ready');
  return !anyPlatformEnabled || !modelReady;
}