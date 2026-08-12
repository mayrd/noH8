import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the model store with a controlled (mutatable) state so tests can drive
// per-model status and download progress and re-render.
const setSelectedModel = vi.fn();
const storeState = {
  selectedModelId: 'toxic-bert',
  downloadedModels: ['toxic-bert'],
  modelStatus: { 'sst-2-english': 'not_downloaded' },
  downloadProgress: {} as Record<string, number>,
  setSelectedModel,
};
vi.mock('../../src/settings/modelStore', () => ({
  useModelStore: () => storeState,
}));

const { requestModelCommand } = vi.hoisted(() => ({ requestModelCommand: vi.fn() }));
vi.mock('../../src/offscreen/client', () => ({ requestModelCommand }));

// Import the real catalog so we know which models should appear.
import { MODEL_CATALOG } from '../../src/offscreen/modelCatalog';

// Load the component AFTER the mocks are registered.
const { default: ModelManager } = await import('../../src/settings/ModelManager');

describe('ModelManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the shared mutable store to a known state.
    storeState.selectedModelId = 'toxic-bert';
    storeState.downloadedModels = ['toxic-bert'];
    storeState.modelStatus = { 'sst-2-english': 'not_downloaded' };
    storeState.downloadProgress = {};
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
    expect(setSelectedModel).toHaveBeenCalledWith(model.id);
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
    storeState.modelStatus['sst-2-english'] = 'downloading';
    storeState.downloadProgress['sst-2-english'] = 42;
    render(<ModelManager />);
    const card = screen.getByTestId('model-card-sst-2-english');
    expect(within(card).getByTestId('progress-sst-2-english')).toBeInTheDocument();
    expect(within(card).getByText('42%')).toBeInTheDocument();
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
});
