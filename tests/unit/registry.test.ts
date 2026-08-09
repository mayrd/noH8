import { describe, test, expect } from 'vitest';
import {
  getEnabledAdapters,
  getAvailableAdapterNames,
} from '../../src/content/adapters/registry';

describe('AdapterRegistry', () => {
  test('returns an empty array when no platforms are enabled', async () => {
    const adapters = await getEnabledAdapters([]);
    expect(adapters).toHaveLength(0);
  });

  test('loads the youtube adapter', async () => {
    const adapters = await getEnabledAdapters(['youtube']);
    expect(adapters).toHaveLength(1);
    expect(adapters[0].platformName).toBe('youtube');
  });

  test('ignores unknown platform names', async () => {
    const adapters = await getEnabledAdapters(['youtube', 'nope']);
    expect(adapters).toHaveLength(1);
  });

  test('loads multiple platforms in order', async () => {
    const adapters = await getEnabledAdapters(['tiktok', 'facebook']);
    expect(adapters.map((a) => a.platformName)).toEqual(['tiktok', 'facebook']);
  });

  test('never returns the BaseAdapter when a non-adapter platform is requested', async () => {
    const adapters = await getEnabledAdapters(['base']);
    expect(adapters).toHaveLength(0);
  });

  test('reports every real platform adapter as available', () => {
    const names = getAvailableAdapterNames().sort();
    expect(names).toEqual(['facebook', 'instagram', 'tiktok', 'youtube']);
  });

  test('loads the youtube, instagram, facebook and tiktok adapters together', async () => {
    const adapters = await getEnabledAdapters(['youtube', 'instagram', 'facebook', 'tiktok']);
    expect(adapters.map((a) => a.platformName).sort()).toEqual([
      'facebook',
      'instagram',
      'tiktok',
      'youtube',
    ]);
  });
});
