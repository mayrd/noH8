import { create } from 'zustand';
import type {
  Platform,
} from '../settings/types';
import type {
  Sentiment,
  DetectedIssue,
  IssueId,
} from '../shared/types';

export const FLAGGED_STORAGE_KEY = 'noh8_flagged_comments';
export const MAX_STORED_FLAGS = 500;

export interface FlaggedComment {
  id: string;
  commentId: string;
  platform: Platform;
  author: string;
  text: string;
  url: string;
  tabId?: number;
  timestamp: number;
  sentiment: Sentiment;
  isHateSpeech: boolean;
  hateSpeechScore: number;
  issues: DetectedIssue[];
}

export interface FlagFilterOptions {
  url?: string;
  issue?: IssueId | 'all';
  sortBy?: 'newest' | 'score';
}

function hasLocalStorage(): boolean {
  return Boolean(typeof chrome !== 'undefined' && chrome.storage?.local);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Retrieve all flagged comments from chrome.storage.local.
 */
export async function getFlaggedComments(): Promise<FlaggedComment[]> {
  if (!hasLocalStorage()) return [];
  const result = await new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.local.get(FLAGGED_STORAGE_KEY, (res) => resolve(res ?? {}));
  });
  const data = result[FLAGGED_STORAGE_KEY];
  return Array.isArray(data) ? (data as FlaggedComment[]) : [];
}

/**
 * Save or update a flagged comment in chrome.storage.local. Deduplicates by
 * `commentId` and `url`.
 */
export async function recordFlaggedComment(
  item: Omit<FlaggedComment, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): Promise<FlaggedComment> {
  const existing = await getFlaggedComments();
  const timestamp = item.timestamp ?? Date.now();
  const id = item.id ?? generateId();

  const record: FlaggedComment = {
    ...item,
    id,
    timestamp,
  };

  const existingIdx = existing.findIndex(
    (c) => c.commentId === item.commentId && c.url === item.url
  );

  let updated: FlaggedComment[];
  if (existingIdx >= 0) {
    updated = [...existing];
    updated[existingIdx] = {
      ...existing[existingIdx],
      ...record,
      id: existing[existingIdx].id,
      timestamp: existing[existingIdx].timestamp,
    };
  } else {
    updated = [record, ...existing].slice(0, MAX_STORED_FLAGS);
  }

  if (hasLocalStorage()) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [FLAGGED_STORAGE_KEY]: updated }, () => resolve());
    });
  }

  return record;
}

/**
 * Clear stored comments globally or filtered by url/tab.
 */
export async function clearFlaggedComments(options?: {
  url?: string;
  tabId?: number;
}): Promise<void> {
  if (!hasLocalStorage()) return;

  if (!options?.url && options?.tabId === undefined) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove(FLAGGED_STORAGE_KEY, () => resolve());
    });
    return;
  }

  const existing = await getFlaggedComments();
  const filtered = existing.filter((c) => {
    if (options.url && c.url === options.url) return false;
    if (options.tabId !== undefined && c.tabId === options.tabId) return false;
    return true;
  });

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [FLAGGED_STORAGE_KEY]: filtered }, () => resolve());
  });
}

/**
 * Pure helper function to filter and sort flagged comments.
 */
export function filterFlaggedComments(
  comments: FlaggedComment[],
  options: FlagFilterOptions = {}
): FlaggedComment[] {
  let result = [...comments];

  if (options.url) {
    result = result.filter((c) => c.url === options.url);
  }

  if (options.issue && options.issue !== 'all') {
    result = result.filter((c) => c.issues.some((issue) => issue.id === options.issue));
  }

  if (options.sortBy === 'score') {
    result.sort((a, b) => b.hateSpeechScore - a.hateSpeechScore);
  } else if (options.sortBy === 'newest') {
    result.sort((a, b) => b.timestamp - a.timestamp);
  }

  return result;
}

export interface FlagStoreState {
  comments: FlaggedComment[];
  activeUrl: string;
  activeTabId: number | null;
  filterIssue: IssueId | 'all';
  sortBy: 'newest' | 'score';
  setComments: (comments: FlaggedComment[]) => void;
  setActiveUrl: (url: string) => void;
  setActiveTabId: (tabId: number | null) => void;
  setFilterIssue: (issue: IssueId | 'all') => void;
  setSortBy: (sortBy: 'newest' | 'score') => void;
  loadComments: () => Promise<void>;
  clearActiveComments: () => Promise<void>;
  clearAllComments: () => Promise<void>;
}

export const useFlagStore = create<FlagStoreState>((set, get) => ({
  comments: [],
  activeUrl: '',
  activeTabId: null,
  filterIssue: 'all',
  sortBy: 'newest',
  setComments: (comments: FlaggedComment[]): void => set({ comments }),
  setActiveUrl: (activeUrl: string): void => set({ activeUrl }),
  setActiveTabId: (activeTabId: number | null): void => set({ activeTabId }),
  setFilterIssue: (filterIssue: IssueId | 'all'): void => set({ filterIssue }),
  setSortBy: (sortBy: 'newest' | 'score'): void => set({ sortBy }),
  loadComments: async (): Promise<void> => {
    const comments = await getFlaggedComments();
    set({ comments });
  },
  clearActiveComments: async (): Promise<void> => {
    const { activeUrl, activeTabId } = get();
    await clearFlaggedComments({
      url: activeUrl || undefined,
      tabId: activeTabId ?? undefined,
    });
    const comments = await getFlaggedComments();
    set({ comments });
  },
  clearAllComments: async (): Promise<void> => {
    await clearFlaggedComments();
    set({ comments: [] });
  },
}));

let isInitialized = false;

/**
 * Initialize flag store and wire chrome.storage.onChanged listener.
 */
export async function initFlagStore(): Promise<void> {
  await useFlagStore.getState().loadComments();

  if (isInitialized) return;
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[FLAGGED_STORAGE_KEY]) {
        const newComments = changes[FLAGGED_STORAGE_KEY].newValue as FlaggedComment[] | undefined;
        useFlagStore.getState().setComments(Array.isArray(newComments) ? newComments : []);
      }
    });
    isInitialized = true;
  }
}
