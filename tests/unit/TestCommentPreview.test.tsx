import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import type { CommentAnalysis } from '../../src/shared/types';
import { analyzeCommentText } from '../../src/content/analysis/sentimentAnalyzer';

vi.mock('../../src/offscreen/client', () => ({
  requestModelCommand: vi.fn(),
  requestAnalyze: vi.fn(() => Promise.reject(new Error('unavailable in tests'))),
}));

const { default: TestCommentPreview } = await import(
  '../../src/settings/TestCommentPreview'
);

function cleanAnalysis(text: string): CommentAnalysis {
  return analyzeCommentText({ id: 'settings-test-preview', text });
}

describe('TestCommentPreview', () => {
  test('renders an input box with an accessible label', () => {
    render(<TestCommentPreview />);
    expect(
      screen.getByLabelText(/type a comment to preview/i)
    ).toBeInTheDocument();
  });

  test('shows the typed comment text in the social-media-style preview', async () => {
    const user = userEvent.setup();
    render(<TestCommentPreview />);
    const input = screen.getByLabelText(/type a comment to preview/i);
    await user.type(input, 'hello world');
    expect(screen.getByTestId('test-preview-comment')).toHaveTextContent(
      'hello world'
    );
  });

  test('shows a rainbow button next to the preview once text is typed', async () => {
    const user = userEvent.setup();
    render(<TestCommentPreview />);
    await user.type(
      screen.getByLabelText(/type a comment to preview/i),
      'hello world'
    );
    await waitFor(() => {
      expect(
        screen.getByTestId('test-preview-rainbow')
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId('test-preview-rainbow')).toHaveTextContent('🌈');
  });

  test('clicking the rainbow button opens the full analysis modal', async () => {
    const user = userEvent.setup();
    render(<TestCommentPreview />);
    await user.type(
      screen.getByLabelText(/type a comment to preview/i),
      'hello world'
    );
    const rainbow = await screen.findByTestId('test-preview-rainbow');
    await user.click(rainbow);
    await waitFor(() => {
      expect(document.querySelector('[data-noh8-modal-overlay]')).not.toBeNull();
    });
    // Modal carries the same verdict copy as on social pages.
    expect(document.body.textContent ?? '').toMatch(/NoH8 Comment Analysis/);
    // Clean up the modal appended to document.body.
    document.querySelector('[data-noh8-modal-overlay]')?.remove();
  });

  test('flagged text surfaces the flagged status in the preview', async () => {
    const user = userEvent.setup();
    const flagged = analyzeCommentText({
      id: 'settings-test-preview',
      text: 'exterminate them all, nazis rule',
    });
    expect(flagged.isHateSpeech).toBe(true);
    const analyze = vi.fn(async () => flagged);
    render(<TestCommentPreview analyze={analyze} />);
    await user.type(
      screen.getByLabelText(/type a comment to preview/i),
      'exterminate them all'
    );
    await waitFor(() => {
      expect(screen.getByTestId('test-preview-status')).toHaveTextContent(
        /flagged/i
      );
    });
  });

  test('uses an injectable analyze seam and shows analyzing state', async () => {
    let resolveAnalyze!: (value: CommentAnalysis) => void;
    const pending = new Promise<CommentAnalysis>((resolve) => {
      resolveAnalyze = resolve;
    });
    const analyze = vi.fn(() => pending);
    const user = userEvent.setup();
    render(<TestCommentPreview analyze={analyze} />);
    await user.type(
      screen.getByLabelText(/type a comment to preview/i),
      'hi'
    );
    await waitFor(() => {
      expect(screen.getByTestId('test-preview-status')).toHaveTextContent(
        /analyzing/i
      );
    });
    resolveAnalyze(cleanAnalysis('hi'));
    await waitFor(() => {
      expect(screen.getByTestId('test-preview-rainbow')).toBeInTheDocument();
    });
  });
});
