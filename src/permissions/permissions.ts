import { getMatchesForPlatform } from '../content/platformConfig';
import type { Platform } from '../settings/types';

/**
 * Permission helpers that let the extension check whether it has permission
 * to parse a platform's pages. Social media origins are declared in the
 * manifest's host_permissions (required for content_script injection), so
 * chrome.permissions.contains() is always available for them.
 */

function hasPermissionsApi(chromeObj: any): boolean {
  return Boolean(
    chromeObj &&
      chromeObj.permissions &&
      chromeObj.permissions.request &&
      chromeObj.permissions.contains
  );
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
    // When the origins are already granted via the manifest's host_permissions
    // (which is the case for all social media URLs since content scripts
    // require them there, not in optional_host_permissions), contains()
    // returns true immediately — no need to prompt the user again.
    const alreadyGranted = await chrome.permissions.contains({ origins });
    if (alreadyGranted) return true;
    // Origins not yet granted must be declared in optional_host_permissions
    // in the manifest to be requestable at runtime.
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