import { describe, test, expect, vi } from 'vitest';
import {
  renderCommentControls,
  createRainbowButton,
} from '../../src/content/ui/commentUi';
import { analyzeCommentText } from '../../src/content/analysis/sentimentAnalyzer';
import { FakeEl, makeDoc, makeWindow } from './fakeDom';

const COMMENT = {
  id: 'instagram-abc123',
  platform: 'instagram' as const,
  author: 'tester_user',
  text: 'this is just awful and terrible',
};

function makeContainer(alreadyDecorated = false): FakeEl {
  const container = new FakeEl('li');
  container.dataset['noh8RainbowButton'] = alreadyDecorated ? 'true' : '';
  return container;
}

describe('renderCommentControls', () => {
  test('appends a rainbow button to the comment container', () => {
    const container = makeContainer();
    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    renderCommentControls({ container: container as never, comment: COMMENT, analysis, doc });

    const button = container.findByData('noh8Rainbow');
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe('🌈');
    expect(container.children.some((child) => child.attrs['data-noh8-rainbow'] === 'true')).toBe(true);
  });

  test('does not render a second button when called twice', () => {
    const container = makeContainer();
    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    renderCommentControls({ container: container as never, comment: COMMENT, analysis, doc });
    renderCommentControls({ container: container as never, comment: COMMENT, analysis, doc });

    const buttons = container.findButtons().filter(
      (button) => button.dataset['noh8Rainbow'] === 'true'
    );
    expect(buttons).toHaveLength(1);
  });

  test('clicking the rainbow button opens an analysis modal', () => {
    const container = makeContainer();
    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    renderCommentControls({ container: container as never, comment: COMMENT, analysis, doc, windowRef: makeWindow() });

    const button = container.findByData('noh8Rainbow')!;
    expect(button).not.toBeNull();
    button.click();

    expect((doc.body as unknown as FakeEl).findByData('noh8ModalOverlay')).not.toBeNull();
  });
});

describe('renderCommentControls (Instagram heart-button placement)', () => {
  const HEART_SELECTOR = '[data-heart-button]';

  test('places the rainbow button beneath the heart button when a selector is provided', () => {
    const container = new FakeEl('li');
    const actionsRow = new FakeEl('div');
    const heartButton = new FakeEl('button');
    actionsRow.appendChild(heartButton);
    container.appendChild(actionsRow);
    container.querySelector = vi.fn((sel: string) =>
      sel === HEART_SELECTOR ? heartButton : null
    );

    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    renderCommentControls({
      container: container as never,
      comment: COMMENT,
      analysis,
      doc,
      heartButtonSelector: HEART_SELECTOR,
    });

    expect(container.querySelector).toHaveBeenCalledWith(HEART_SELECTOR);

    const rainbow = container.findByData('noh8Rainbow');
    expect(rainbow).not.toBeNull();
    expect(rainbow!.parentNode).toBe(heartButton.parentNode);
    const siblings = heartButton.parentNode!.children;
    const heartIdx = siblings.indexOf(heartButton);
    const rainbowIdx = siblings.indexOf(rainbow!);
    expect(rainbowIdx).toBe(heartIdx + 1);
  });

  test('falls back to appending to the container when the heart button is absent', () => {
    const container = new FakeEl('li');
    const actionsRow = new FakeEl('div');
    container.appendChild(actionsRow);
    container.querySelector = vi.fn(() => null);

    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    renderCommentControls({
      container: container as never,
      comment: COMMENT,
      analysis,
      doc,
      heartButtonSelector: HEART_SELECTOR,
    });

    const rainbow = container.findByData('noh8Rainbow');
    expect(rainbow).not.toBeNull();
    expect(container.children.includes(rainbow!)).toBe(true);
  });

  test('remains idempotent when anchored under the heart button', () => {
    const container = new FakeEl('li');
    const heartButton = new FakeEl('button');
    container.appendChild(heartButton);
    container.querySelector = vi.fn((sel: string) =>
      sel === HEART_SELECTOR ? heartButton : null
    );

    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    renderCommentControls({ container: container as never, comment: COMMENT, analysis, doc, heartButtonSelector: HEART_SELECTOR });
    renderCommentControls({ container: container as never, comment: COMMENT, analysis, doc, heartButtonSelector: HEART_SELECTOR });

    const rainbowButtons = container
      .findButtons()
      .filter((b) => b.dataset['noh8Rainbow'] === 'true');
    expect(rainbowButtons).toHaveLength(1);
  });
});

describe('createRainbowButton', () => {
  test('creates a button with correct aria-label and emoji', () => {
    const doc = makeDoc();
    const analysis = analyzeCommentText(COMMENT);

    const button = createRainbowButton(doc, COMMENT, analysis) as unknown as FakeEl;

    expect(button.textContent).toBe('🌈');
    expect(button.attrs['aria-label']).toContain(COMMENT.author);
    expect(button.dataset['noh8Rainbow']).toBe('true');
  });
});
