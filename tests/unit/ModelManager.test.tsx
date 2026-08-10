import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the model store with a controlled state.
const setSelectedModel = vi.fn();
vi.mock('../../src/settings/modelStore', () => ({
  useModelStore: () => ({
    selectedModelId: 'toxic-bert',
    downloadedModels: ['toxic-bert'],
    modelStatus: { 'sst-2-english': 'error' },
    setSelectedModel,
  }),
}));

vi.mock('../../src/offscreen/client', () => ({
  requestModelCommand: vi.fn(),
}));

// Import the real catalog so we know which models should appear.
import { MODEL_CATALOG } from '../../src/offscreen/modelCatalog';

// Load the component AFTER the mocks are registered.
const { default: ModelManager } = await import('../../src/settings/ModelManager');

describe('ModelManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

