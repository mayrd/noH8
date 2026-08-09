import { getMatchesForPlatform } from '../content/platformConfig';
import type { Platform } from '../settings/types';

/**
 * Permission helpers that let the extension ask the user to allow parsing a
 * platform's pages. They rely on the optional host permissions that are
 * declared in the manifest and scoped to each platform's origins.
 */

function hasPermissionsApi(chromeObj: any): boolean {
  return Boolean(chromeObj && chromeObj.permissions && chromeObj.permissions.request);
}

/**
 * Request the user's permission to parse the pages for the given platform.
 * The user is prompted the first time this is called (a subsequent request for
 * an already-granted origin resolves immediately to `true`). Resolves `false`
 * if the runtime does not expose chrome or the user declines.
 */
export async function requestPlatformPermission(platform: Platform): Promise<boolean> {
  if (typeof chrome === 'undefined' || !hasPermissionsApi(chrome)) {
    return false;
  }
  const origins = getMatchesForPlatform(platform);
  try {
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}

/**
 * Returns whether the extension already has permission to parse the given
 * platform's pages.
 */
export async function isPlatformAccessible(platform: Platform): Promise<boolean> {
  if (typeof chrome === 'undefined' || !hasPermissionsApi(chrome)) {
    return false;
  }
  const origins = getMatchesForPlatform(platform);
  try {
    return await chrome.permissions.contains({ origins });
  } catch {
    return false;
  }
}