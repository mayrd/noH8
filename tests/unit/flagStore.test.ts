import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FLAGGED_STORAGE_KEY,
  recordFlaggedComment,
  getFlaggedComments,
  clearFlaggedComments,
  filterFlaggedComments,
  useFlagStore,
  initFlagStore,
  type FlaggedComment,
} from '../../src/sidepanel/flagStore';

function createMockChromeStorage(initialData: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initialData };
  const listeners: Array<(changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void> = [];

  return {
    storage: {
      local: {
        get: vi.fn((key: string | string[] | null, callback?: (res: Record<string, unknown>) => void) => {
          let result: Record<string, unknown> = {};
          if (typeof key === 'string') {
            result = { [key]: store[key] };
          } else if (Array.isArray(key)) {
            key.forEach((k) => {
              result[k] = store[k];
            });
          } else {
            result = { ...store };
          }
          if (callback) callback(result);
          return Promise.resolve(result);
        }),
        set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
          const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
          Object.entries(items).forEach(([k, v]) => {
            changes[k] = { oldValue: store[k], newValue: v };
            store[k] = v;
          });
          listeners.forEach((listener) => listener(changes, 'local'));
          if (callback) callback();
          return Promise.resolve();
        }),
        remove: vi.fn((key: string | string[], callback?: () => void) => {
          const keys = Array.isArray(key) ? key : [key];
          const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
          keys.forEach((k) => {
            changes[k] = { oldValue: store[k], newValue: undefined };
            delete store[k];
          });
          listeners.forEach((listener) => listener(changes, 'local'));
          if (callback) callback();
          return Promise.resolve();
        }),
      },
      onChanged: {
        addListener: vi.fn((fn) => listeners.push(fn)),
        removeListener: vi.fn((fn) => {
          const idx = listeners.indexOf(fn);
          if (idx !== -1) listeners.splice(idx, 1);
        }),
      },
    },
    rawStore: store,
  };
}

describe('flagStore', () => {
  let mockChrome: ReturnType<typeof createMockChromeStorage>;

  beforeEach(() => {
    mockChrome = createMockChromeStorage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = mockChrome;
    useFlagStore.setState({
      comments: [],
      activeUrl: '',
      activeTabId: null,
      filterIssue: 'all',
      sortBy: 'newest',
    });
  });

  const sampleComment1: Omit<FlaggedComment, 'id' | 'timestamp'> = {
    commentId: 'yt-123',
    platform: 'youtube',
    author: 'Troll42',
    text: 'Hateful abusive statement',
    url: 'https://www.youtube.com/watch?v=abc',
    sentiment: { score: -0.9, label: 'negative' },
    isHateSpeech: true,
    hateSpeechScore: 0.95,
    issues: [
      {
        id: 'hate_speech',
        label: 'Hate Speech',
        description: 'Contains hateful language',
      },
    ],
  };

  const sampleComment2: Omit<FlaggedComment, 'id' | 'timestamp'> = {
    commentId: 'ig-456',
    platform: 'instagram',
    author: 'Bully99',
    text: 'Harassing message',
    url: 'https://www.instagram.com/p/xyz/',
    sentiment: { score: -0.6, label: 'negative' },
    isHateSpeech: false,
    hateSpeechScore: 0.4,
    issues: [
      {
        id: 'harassment',
        label: 'Harassment',
        description: 'Targeted harassment',
      },
    ],
  };

  it('records a new flagged comment into chrome.storage.local', async () => {
    const saved = await recordFlaggedComment(sampleComment1);
    expect(saved.id).toBeDefined();
    expect(saved.timestamp).toBeGreaterThan(0);
    expect(saved.commentId).toBe('yt-123');

    const stored = await getFlaggedComments();
    expect(stored).toHaveLength(1);
    expect(stored[0].author).toBe('Troll42');
  });

  it('deduplicates comments by commentId and url', async () => {
    await recordFlaggedComment(sampleComment1);
    await recordFlaggedComment({ ...sampleComment1, hateSpeechScore: 0.98 });

    const stored = await getFlaggedComments();
    expect(stored).toHaveLength(1);
    expect(stored[0].hateSpeechScore).toBe(0.98);
  });

  it('clears flagged comments globally or filtered by url', async () => {
    await recordFlaggedComment(sampleComment1);
    await recordFlaggedComment(sampleComment2);

    expect(await getFlaggedComments()).toHaveLength(2);

    await clearFlaggedComments({ url: 'https://www.youtube.com/watch?v=abc' });
    const remaining = await getFlaggedComments();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].platform).toBe('instagram');

    await clearFlaggedComments();
    expect(await getFlaggedComments()).toHaveLength(0);
  });

  it('filters and sorts flagged comments correctly', () => {
    const item1: FlaggedComment = {
      ...sampleComment1,
      id: '1',
      timestamp: 1000,
      hateSpeechScore: 0.8,
    };
    const item2: FlaggedComment = {
      ...sampleComment2,
      id: '2',
      timestamp: 2000,
      hateSpeechScore: 0.95,
    };
    const list = [item1, item2];

    // Filter by issue
    const filteredHarassment = filterFlaggedComments(list, { issue: 'harassment' });
    expect(filteredHarassment).toHaveLength(1);
    expect(filteredHarassment[0].id).toBe('2');

    // Filter by url match
    const filteredUrl = filterFlaggedComments(list, { url: 'https://www.youtube.com/watch?v=abc' });
    expect(filteredUrl).toHaveLength(1);
    expect(filteredUrl[0].id).toBe('1');

    // Sort by score
    const sortedByScore = filterFlaggedComments(list, { sortBy: 'score' });
    expect(sortedByScore[0].id).toBe('2'); // 0.95 > 0.8

    // Sort by newest
    const sortedByNewest = filterFlaggedComments(list, { sortBy: 'newest' });
    expect(sortedByNewest[0].id).toBe('2'); // timestamp 2000 > 1000
  });

  it('initializes the store and reacts to chrome.storage.onChanged', async () => {
    await recordFlaggedComment(sampleComment1);
    await initFlagStore();

    expect(useFlagStore.getState().comments).toHaveLength(1);

    // Simulate external change
    await recordFlaggedComment(sampleComment2);
    expect(useFlagStore.getState().comments).toHaveLength(2);
  });
});
