import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Use the REAL store (unmocked) so the badge-flip test exercises the real
// optimistic `setModelStatus`/`markModelDownloaded` path. Tests drive status
// via `act(() => modelStore.setState(...))` wrapped in the render helper.
import { modelStore } from '../../src/settings/modelStore';
import ModelManager from '../../src/settings/ModelManager';

// Install a minimal chrome.storage.local mock before any store write.
const localGet = vi.fn((_key: unknown, cb: (items: Record<string, unknown>) => void) => cb({}));
const localSet = vi.fn((_items: Record<string, unknown>, cb?: () => void) => cb?.());
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: { local: { get: localGet, set: localSet } },
} as unknown;

const { requestModelCommand } = vi.hoisted(() => ({ requestModelCommand: vi.fn() }));
vi.mock('../../src/offscreen/client', () => ({ requestModelCommand }));

// Import the real catalog so we know which models should appear.
import { MODEL_CATALOG } from '../../src/offscreen/modelCatalog';

/** Seed the real store to a known state for each test. */
function seedStore(partial: Record<string, unknown> = {}): void {
  modelStore.setState({
    selectedModelId: 'toxic-bert',
    secondaryModelId: null,
    downloadedModels: ['toxic-bert'],
    modelStatus: { 'sst-2-english': 'not_downloaded' },
    downloadProgress: {},
    downloadDetails: {},
    ...partial,
  });
}

describe('ModelManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedStore();
  });

  test('renders every model from the catalog', () => {
    render(<ModelManager />);
    MODEL_CATALOG.forEach((model) => {
      expect(screen.getByText(model.name)).toBeInTheDocument();
    });
  });

  test('renders a section heading and description', () => {
    render(<ModelManager />);
    expect(screen.getByText('Detection Model')).toBeInTheDocument();
    expect(screen.getByText(/machine-learning model/i)).toBeInTheDocument();
  });

  test('highlights the selected model card', () => {
    render(<ModelManager />);
    const cards = screen.getAllByTestId(/^model-card-/);
    const selectedCard = cards.find((c) => c.getAttribute('data-model-id') === 'toxic-bert');
    expect(selectedCard).not.toBeUndefined();
  });

  test('clicking a model radio selects it via the store', async () => {
    const user = userEvent.setup();
    render(<ModelManager />);
    // The second model in the catalog (not currently selected)
    const model = MODEL_CATALOG[1];
    const radio = screen.getByLabelText(model.name);
    await user.click(radio);
    expect(modelStore.getState().selectedModelId).toBe(model.id);
  });

  test('shows a Download button for models that are not yet downloaded', () => {
    render(<ModelManager />);
    // 'sst-2-english' is NOT in downloadedModels (only 'toxic-bert' is).
    const card = screen.getByTestId('model-card-sst-2-english');
    expect(within(card).getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  test('shows Refresh and Delete buttons for downloaded models', () => {
    render(<ModelManager />);
    const card = screen.getByTestId('model-card-toxic-bert');
    expect(within(card).getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  test('renders a status badge for each model', () => {
    render(<ModelManager />);
    MODEL_CATALOG.forEach((model) => {
      expect(screen.getByTestId(`status-${model.id}`)).toBeInTheDocument();
    });
  });

  test('renders one card per model in the catalog', () => {
    render(<ModelManager />);
    const cards = screen.getAllByTestId(/^model-card-/);
    expect(cards.length).toBe(MODEL_CATALOG.length);
  });

  test('shows a progress bar with the current percent while downloading', () => {
    seedStore({
      modelStatus: { 'sst-2-english': 'downloading' },
      downloadProgress: { 'sst-2-english': 42 },
    });
    render(<ModelManager />);
    const card = screen.getByTestId('model-card-sst-2-english');
    expect(within(card).getByTestId('progress-sst-2-english')).toBeInTheDocument();
    expect(within(card).getByTestId('progress-text-sst-2-english')).toHaveTextContent('42%');
  });

  test('shows progress on the file size while downloading', () => {
    seedStore({
      modelStatus: { 'sst-2-english': 'downloading' },
      downloadDetails: {
        'sst-2-english': {
          loadedBytes: 33790598,
          totalBytes: 67581197,
          percent: 50,
          file: 'onnx/model_quantized.onnx',
        },
      },
    });
    render(<ModelManager />);
    const card = screen.getByTestId('model-card-sst-2-english');
    // "x of y · z%" — progress rendered on the file size, not a bare percent.
    expect(within(card).getByTestId('progress-text-sst-2-english')).toHaveTextContent(/of/i);
    expect(within(card).getByTestId('progress-text-sst-2-english')).toHaveTextContent(/50%/);
    expect(within(card).getByTestId('progress-text-sst-2-english')).toHaveTextContent(/MB/);
    expect(within(card).getByTestId('progress-file-sst-2-english')).toHaveTextContent(
      /model_quantized\.onnx/
    );
  });

  test('shows the file size for every model card', () => {
    render(<ModelManager />);
    MODEL_CATALOG.forEach((model) => {
      expect(screen.getByTestId(`size-${model.id}`)).toHaveTextContent(/MB|KB| B/);
    });
  });

  test('flips the status badge from "Not downloaded" to ready during download', async () => {
    let resolveCommand!: () => void;
    requestModelCommand.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCommand = resolve;
        })
    );
    const user = userEvent.setup();
    render(<ModelManager />);
    const card = screen.getByTestId('model-card-sst-2-english');
    // Pre-click: the untouched model reads "Not downloaded".
    expect(within(card).getByTestId('status-sst-2-english')).toHaveTextContent(/not downloaded/i);

    await user.click(within(card).getByRole('button', { name: /download/i }));
    // While the command is in flight the optimistic status flips to Downloading.
    expect(await within(card).findByTestId('progress-sst-2-english')).toBeInTheDocument();
    expect(within(card).getByTestId('status-sst-2-english')).toHaveTextContent(/downloading/i);

    // Resolve: the optimistic completion flips "Not downloaded" -> ready.
    resolveCommand();
    expect(await screen.findByTestId('notice-sst-2-english')).toHaveTextContent(
      /downloaded successfully/i
    );
    expect(within(card).getByTestId('status-sst-2-english')).toHaveTextContent(/ready/i);
    expect(within(card).getByTestId('status-sst-2-english')).not.toHaveTextContent(
      /not downloaded/i
    );
    expect(modelStore.getState().downloadedModels).toContain('sst-2-english');
    expect(modelStore.getState().modelStatus['sst-2-english']).toBe('ready');
  });

  test('shows a success message after a download completes', async () => {
    requestModelCommand.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ModelManager />);
    const card = screen.getByTestId('model-card-sst-2-english');
    await user.click(within(card).getByRole('button', { name: /download/i }));
    expect(requestModelCommand).toHaveBeenCalledWith('download', 'sst-2-english');
    expect(await screen.findByTestId('notice-sst-2-english')).toHaveTextContent(
      /downloaded successfully/i
    );
  });

  test('shows an error message when a download fails', async () => {
    requestModelCommand.mockRejectedValue(new Error('network timeout'));
    const user = userEvent.setup();
    render(<ModelManager />);
    const card = screen.getByTestId('model-card-sst-2-english');
    await user.click(within(card).getByRole('button', { name: /download/i }));
    expect(await screen.findByTestId('notice-sst-2-english')).toHaveTextContent(
      /could not download.*network timeout/i
    );
  });

  // --- M16: retry affordance, failure classification, stale-model nudge ---

  test('shows a Retry button for a model whose download failed', () => {
    seedStore({ modelStatus: { 'sst-2-english': 'error' } });
    render(<ModelManager />);
    const card = screen.getByTestId('model-card-sst-2-english');
    expect(within(card).getByTestId('retry-sst-2-english')).toBeInTheDocument();
  });

  test('retrying a failed download re-runs the download command', async () => {
    requestModelCommand.mockResolvedValue(undefined);
    seedStore({ modelStatus: { 'sst-2-english': 'error' } });
    const user = userEvent.setup();
    render(<ModelManager />);
    const card = screen.getByTestId('model-card-sst-2-english');
    await user.click(within(card).getByTestId('retry-sst-2-english'));
    expect(requestModelCommand).toHaveBeenCalledWith('download', 'sst-2-english');
  });

  test('classifies a network failure and surfaces the class alongside the error', async () => {
    requestModelCommand.mockRejectedValue(new Error('fetch failed: network unreachable'));
    seedStore({ modelStatus: { 'sst-2-english': 'error' } });
    const user = userEvent.setup();
    render(<ModelManager />);
    const card = screen.getByTestId('model-card-sst-2-english');
    await user.click(within(card).getByRole('button', { name: 'Download' }));
    expect(await screen.findByTestId('failure-sst-2-english')).toHaveTextContent(
      /network problem/i
    );
  });

  test('classifies a quota failure distinctly from a network failure', async () => {
    requestModelCommand.mockRejectedValue(new Error('quota exceeded'));
    seedStore({ modelStatus: { 'sst-2-english': 'error' } });
    const user = userEvent.setup();
    render(<ModelManager />);
    const card = screen.getByTestId('model-card-sst-2-english');
    await user.click(within(card).getByRole('button', { name: 'Download' }));
    expect(await screen.findByTestId('failure-sst-2-english')).toHaveTextContent(
      /storage quota/i
    );
  });

  test('warns when the selected model id no longer resolves in the catalog', () => {
    seedStore({ selectedModelId: 'deleted-model-x' });
    render(<ModelManager />);
    expect(screen.getByTestId('stale-model-warning')).toHaveTextContent(/deleted-model-x/);
  });

  test('shows no stale-model warning while the selected model is in the catalog', () => {
    render(<ModelManager />);
    expect(screen.queryByTestId('stale-model-warning')).not.toBeInTheDocument();
  });

  // --- M17: secondary (consensus) model selection ---

  test('renders a consensus checkbox for every model card (M17)', () => {
    render(<ModelManager />);
    MODEL_CATALOG.forEach((model) => {
      expect(screen.getByTestId(`secondary-${model.id}`)).toBeInTheDocument();
    });
  });

  test('checking a consensus box selects that model as secondary (M17)', async () => {
    const user = userEvent.setup();
    render(<ModelManager />);
    // 'sst-2-english' is not the selected model, so its box is enabled.
    await user.click(screen.getByTestId('secondary-sst-2-english'));
    expect(modelStore.getState().secondaryModelId).toBe('sst-2-english');
  });

  test('unchecking the secondary model clears the selection (M17)', async () => {
    seedStore({ secondaryModelId: 'sst-2-english' });
    const user = userEvent.setup();
    render(<ModelManager />);
    await user.click(screen.getByTestId('secondary-sst-2-english'));
    expect(modelStore.getState().secondaryModelId).toBeNull();
  });

  test('the selected model cannot be its own secondary (M17)', () => {
    render(<ModelManager />);
    expect(screen.getByTestId('secondary-toxic-bert')).toBeDisabled();
  });
});
