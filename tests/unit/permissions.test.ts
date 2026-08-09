import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  requestPlatformPermission,
  isPlatformAccessible,
} from '../../src/permissions/permissions';
import { getMatchesForPlatform } from '../../src/content/platformConfig';

const INSTAGRAM_MATCHES = getMatchesForPlatform('instagram');

describe('permissions', () => {
  beforeEach(() => {
    delete (globalThis as any).chrome;
  });

  afterEach(() => {
    delete (globalThis as any).chrome;
  });

  test('requestPlatformPermission requests the platform origins from chrome.permissions', async () => {
    const request = vi.fn().mockResolvedValue(true);
    (globalThis as any).chrome = { permissions: { request, contains: vi.fn() } };

    const granted = await requestPlatformPermission('instagram');

    expect(granted).toBe(true);
    expect(request).toHaveBeenCalledWith({ origins: INSTAGRAM_MATCHES });
  });

  test('requestPlatformPermission resolves to false when the user denies', async () => {
    const request = vi.fn().mockResolvedValue(false);
    (globalThis as any).chrome = { permissions: { request, contains: vi.fn() } };

    const granted = await requestPlatformPermission('instagram');

    expect(granted).toBe(false);
  });

  test('requestPlatformPermission resolves to false when chrome is unavailable', async () => {
    const granted = await requestPlatformPermission('instagram');
    expect(granted).toBe(false);
  });

  test('isPlatformAccessible checks contains for the platform origins', async () => {
    const contains = vi.fn().mockResolvedValue(true);
    (globalThis as any).chrome = { permissions: { contains, request: vi.fn() } };

    const accessible = await isPlatformAccessible('instagram');

    expect(accessible).toBe(true);
    expect(contains).toHaveBeenCalledWith({ origins: INSTAGRAM_MATCHES });
  });

  test('isPlatformAccessible resolves to false when chrome is unavailable', async () => {
    const accessible = await isPlatformAccessible('instagram');
    expect(accessible).toBe(false);
  });
});