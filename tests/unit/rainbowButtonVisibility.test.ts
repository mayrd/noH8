import { describe, test, expect, vi } from 'vitest';
import { renderCommentControls } from '../../src/content/ui/commentUi';
import {
  selectCommentContainers,
  queryAll,
} from '../../src/content/adapters/selectorStrategy';
import { createInferenceScheduler } from '../../src/content/analysis/inferenceScheduler';
import { analyzeCommentText } from '../../src/content/analysis/sentimentAnalyzer';
import { FakeEl, makeDoc } from './fakeDom';
import type { CommentAnalysis } from '../../src/shared/types';

const COMMENT = {
  id: 'youtube-abc123',
  platform: 'youtube' as const,
  author: 'tester_user',
  text: 'hello world',
};

function analysis(): CommentAnalysis {
  return analyzeCommentText({ id: COMMENT.id, text: COMMENT.text });
}

describe('rainbow button visibility (youtube/instagram)', () => {
  test('still appends button when the anchor querySelector throws (e.g. i-flag unsupported)', () => {
    const container = new FakeEl('li');
    container.querySelector = vi.fn(() => {
      throw new Error('invalid selector');
    }) as unknown as FakeEl['querySelector'];
    const doc = makeDoc();

    expect(() =>
      renderCommentControls({
        container: container as never,
        comment: COMMENT,
        analysis: analysis(),
        doc,
        heartButtonSelector: 'button[aria-label*="like" i]',
      })
    ).not.toThrow();

    // Button must still be appended via the fallback path.
    expect(container.findByData('noh8Rainbow')).not.toBeNull();
  });

  test('retry after a throwing anchor still renders (no poisoned flag)', () => {
    const container = new FakeEl('li');
    let calls = 0;
    container.querySelector = vi.fn(() => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
      return null;
    }) as unknown as FakeEl['querySelector'];
    const doc = makeDoc();

    renderCommentControls({
      container: container as never,
      comment: COMMENT,
      analysis: analysis(),
      doc,
      heartButtonSelector: 'button[aria-label*="like" i]',
    });
    renderCommentControls({
      container: container as never,
      comment: COMMENT,
      analysis: analysis(),
      doc,
      heartButtonSelector: 'button[aria-label*="like" i]',
    });

    const buttons = container
      .findButtons()
      .filter((b) => b.dataset['noh8Rainbow'] === 'true');
    expect(buttons).toHaveLength(1);
  });

  test('selectCommentContainers finds comments whose text lives in shadowRoot (youtube custom elements)', () => {
    // Real-DOM model: the host IS in light DOM (matches the container
    // selector), but its `#content-text` lives inside its open shadowRoot,
    // invisible to host-level querySelectorAll.
    const textNode = new FakeEl('span');
    textNode.textContent = 'a youtube comment';
    const authorNode = new FakeEl('span');
    authorNode.textContent = 'some_author';
    const shadow = {
      querySelectorAll: (sel: string) => {
        if (sel === '#content-text') return [textNode];
        if (sel === '#author-text') return [authorNode];
        return [];
      },
      querySelector: (sel: string) => {
        if (sel === '#author-text') return authorNode;
        return null;
      },
    };
    const host = new FakeEl('ytd-comment-thread-renderer');
    (host as unknown as Record<string, unknown>)['shadowRoot'] = shadow;
    // Light-DOM queries on the host see nothing (shadow boundary).
    (host as unknown as Record<string, unknown>)['querySelectorAll'] = () => [];
    (host as unknown as Record<string, unknown>)['querySelector'] = () => null;

    // Container discovery works on the light-DOM host…
    const root = { querySelectorAll: () => [host] };
    const out = selectCommentContainers(root as never, {
      primary: ['ytd-comment-thread-renderer'],
    });
    expect(out).toHaveLength(1);

    // …and the shared query pierces the host shadowRoot for text/author.
    expect(queryAll(host as never, '#content-text')).toContain(textNode);
    expect(queryAll(host as never, '#author-text')).toContain(authorNode);
  });

  test('queryAll includes shadow descendants of a shadow host', () => {
    const inner = new FakeEl('span');
    const host = new FakeEl('ytd-comment-renderer');
    (host as unknown as Record<string, unknown>)['shadowRoot'] = {
      querySelectorAll: () => [inner],
      querySelector: () => null,
    };
    // Host-level light-DOM query sees nothing across the shadow boundary…
    (host as unknown as Record<string, unknown>)['querySelectorAll'] = () => [];
    // …but the shared query descends into the open shadow root.
    expect(queryAll(host as never, 'span')).toContain(inner);
  });

  test('orphan reply (parent never scheduled) still resolves instead of hanging', async () => {
    const infer = vi.fn(async (c: { commentId: string }): Promise<CommentAnalysis> => ({
      commentId: c.commentId,
      sentiment: { score: 0, label: 'neutral' as const },
      isHateSpeech: false,
      hateSpeechScore: 0,
      issues: [],
    }));
    const scheduler = createInferenceScheduler({ infer });
    const child = scheduler.schedule({
      commentId: 'child',
      text: 'reply text',
      parentId: 'missing-parent',
    });
    const winner = await Promise.race([
      child.then(() => 'resolved'),
      new Promise((res) => setTimeout(() => res('hung'), 50)),
    ]);
    expect(winner).toBe('resolved');
  });
});
