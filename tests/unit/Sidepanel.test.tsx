import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useFlagStore, type FlaggedComment } from '../../src/sidepanel/flagStore';
import Sidepanel from '../../src/sidepanel/Sidepanel';

const sampleComment: FlaggedComment = {
  id: '1',
  commentId: 'yt-123',
  platform: 'youtube',
  author: 'ToxicUser',
  text: 'Go away and do not come back',
  url: 'https://www.youtube.com/watch?v=123',
  timestamp: Date.now(),
  sentiment: { score: -0.8, label: 'negative' },
  isHateSpeech: true,
  hateSpeechScore: 0.92,
  issues: [
    { id: 'hate_speech', label: 'Hate Speech', description: 'Hate speech detected' },
  ],
};

function setupMockChrome(tabsQueryRes = [{ id: 101, url: 'https://www.youtube.com/watch?v=123' }], storedComments: FlaggedComment[] = []) {
  const sendMessage = vi.fn().mockResolvedValue({ ok: true });
  const tabsCreate = vi.fn().mockResolvedValue({});
  const tabsQuery = vi.fn((_query, cb) => {
    if (cb) cb(tabsQueryRes);
    return Promise.resolve(tabsQueryRes);
  });

  const storageStore: Record<string, unknown> = {
    noh8_flagged_comments: storedComments,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    tabs: {
      query: tabsQuery,
      sendMessage,
      create: tabsCreate,
    },
    storage: {
      local: {
        get: vi.fn((key: string | string[] | null, cb?: (res: Record<string, unknown>) => void) => {
          const res = typeof key === 'string' ? { [key]: storageStore[key] } : storageStore;
          if (cb) cb(res);
          return Promise.resolve(res);
        }),
        set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
          Object.assign(storageStore, items);
          if (cb) cb();
          return Promise.resolve();
        }),
        remove: vi.fn((key: string | string[], cb?: () => void) => {
          const keys = Array.isArray(key) ? key : [key];
          keys.forEach((k) => delete storageStore[k]);
          if (cb) cb();
          return Promise.resolve();
        }),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
      getURL: (path: string) => `chrome-extension://mock-id/${path}`,
    },
  };

  return { sendMessage, tabsCreate, tabsQuery };
}

describe('Sidepanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockChrome();
    useFlagStore.setState({
      comments: [],
      activeUrl: 'https://www.youtube.com/watch?v=123',
      activeTabId: 101,
      filterIssue: 'all',
      sortBy: 'newest',
    });
  });

  test('renders header with NoH8 title and empty state when no comments flagged', () => {
    render(<Sidepanel />);

    expect(screen.getByText('NoH8')).toBeInTheDocument();
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/no flagged comments/i)).toBeInTheDocument();
  });

  test('renders flagged comment card with author, text, issues, and confidence score', () => {
    setupMockChrome(undefined, [sampleComment]);
    useFlagStore.setState({ comments: [sampleComment] });

    render(<Sidepanel />);

    expect(screen.getByText('ToxicUser')).toBeInTheDocument();
    expect(screen.getByText(/Go away and do not come back/)).toBeInTheDocument();
    expect(screen.getByText(/92%/)).toBeInTheDocument();
    expect(screen.getAllByText('Hate Speech').length).toBeGreaterThanOrEqual(1);
  });

  test('clicking "Jump to comment" sends highlight message to the active tab', async () => {
    const { sendMessage } = setupMockChrome(undefined, [sampleComment]);
    useFlagStore.setState({ comments: [sampleComment] });
    const user = userEvent.setup();

    render(<Sidepanel />);

    const jumpButton = screen.getByRole('button', { name: /jump/i });
    await user.click(jumpButton);

    expect(sendMessage).toHaveBeenCalledWith(101, {
      type: 'noh8:highlightComment',
      commentId: 'yt-123',
    });
  });

  test('clicking "Report" opens report url in a new tab', async () => {
    const { tabsCreate } = setupMockChrome(undefined, [sampleComment]);
    useFlagStore.setState({ comments: [sampleComment] });
    const user = userEvent.setup();

    render(<Sidepanel />);

    const reportButton = screen.getByRole('button', { name: /report/i });
    await user.click(reportButton);

    expect(tabsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('support.google.com/youtube'),
      })
    );
  });

  test('clicking clear button clears the comments list', async () => {
    setupMockChrome(undefined, [sampleComment]);
    useFlagStore.setState({ comments: [sampleComment] });
    const user = userEvent.setup();

    render(<Sidepanel />);

    const clearButton = screen.getByRole('button', { name: /clear/i });
    await act(async () => {
      await user.click(clearButton);
    });

    expect(useFlagStore.getState().comments).toHaveLength(0);
  });

  test('clicking "Dismiss" removes the flag and persists the dismissal', async () => {
    setupMockChrome(undefined, [sampleComment]);
    useFlagStore.setState({ comments: [sampleComment] });
    const user = userEvent.setup();

    render(<Sidepanel />);

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    await act(async () => {
      await user.click(dismissButton);
    });

    expect(useFlagStore.getState().comments).toHaveLength(0);
    expect(screen.getByText(/no flagged comments/i)).toBeInTheDocument();
  });

  test('clicking "Export" downloads the flagged comments as JSON', async () => {
    setupMockChrome(undefined, [sampleComment]);
    useFlagStore.setState({ comments: [sampleComment] });
    const user = userEvent.setup();

    const createdUrls: string[] = [];
    const revokeObjectURL = vi.fn();
    const objectURL = vi.fn((blob: Blob) => {
      createdUrls.push('blob:mock-url');
      expect(blob.type).toBe('application/json');
      return 'blob:mock-url';
    });
    Object.defineProperty(globalThis, 'URL', {
      value: { ...globalThis.URL, createObjectURL: objectURL, revokeObjectURL },
      writable: true,
    });
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    render(<Sidepanel />);

    const exportButton = screen.getByRole('button', { name: /export/i });
    await user.click(exportButton);

    expect(objectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    anchorClick.mockRestore();
  });

  test('empty state links to the welcome page for first-run setup', async () => {
    const { tabsCreate } = setupMockChrome();
    useFlagStore.setState({ comments: [] });
    const user = userEvent.setup();

    render(<Sidepanel />);

    expect(screen.getByText(/no flagged comments/i)).toBeInTheDocument();
    const setupButton = screen.getByRole('button', { name: /set up noh8/i });
    await user.click(setupButton);
    expect(tabsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('welcome.html') })
    );
  });
});

// --- M16: heuristic-fallback badge ---------------------------------------

const { healthState } = vi.hoisted(() => ({
  healthState: { fallbackActive: false, modelId: null as string | null, updatedAt: 0 },
}));

vi.mock('../../src/shared/inferenceHealth', () => ({
  getInferenceHealth: vi.fn(async () =>
    healthState.fallbackActive ? { ...healthState } : null
  ),
  subscribeInferenceHealth: vi.fn((cb: (h: unknown) => void) => {
    if (healthState.fallbackActive) cb({ ...healthState });
    return () => {};
  }),
}));

describe('Sidepanel fallback badge (M16)', () => {
  test('shows a badge when the last inference used the heuristic fallback', async () => {
    setupMockChrome();
    useFlagStore.setState({ comments: [] });
    healthState.fallbackActive = true;
    healthState.modelId = 'toxic-bert';

    render(<Sidepanel />);

    expect(await screen.findByTestId('fallback-badge')).toBeInTheDocument();
    expect(screen.getByTestId('fallback-badge')).toHaveTextContent(/heuristic fallback/i);
    healthState.fallbackActive = false;
  });

  test('shows no badge while the model pipeline is healthy', async () => {
    setupMockChrome();
    useFlagStore.setState({ comments: [] });
    healthState.fallbackActive = false;

    render(<Sidepanel />);

    await screen.findByText(/no flagged comments/i);
    expect(screen.queryByTestId('fallback-badge')).not.toBeInTheDocument();
  });
});
