import { describe, test, expect } from 'vitest';
import YouTubeAdapter from '../../src/content/adapters/youtubeAdapter';
import { queryAll } from '../../src/content/adapters/selectorStrategy';
import { FakeEl } from './fakeDom';

function tag(el: FakeEl, tagName: string): void {
  (el as unknown as Record<string, unknown>)['tagName'] = tagName;
}

describe('YouTube modern view-model DOM (RED)', () => {
  test('extractComments finds comments rendered as ytd-comment-view-model (no thread renderer)', () => {
    const textSpan = new FakeEl('span');
    textSpan.textContent = 'modern youtube comment';
    const authorNode = new FakeEl('span');
    authorNode.textContent = 'modern_author';
    const viewModel = new FakeEl('ytd-comment-view-model');
    tag(viewModel, 'YTD-COMMENT-VIEW-MODEL');
    (viewModel as unknown as Record<string, unknown>)['querySelectorAll'] = (sel: string) =>
      sel.includes('#content-text') || sel.includes('content-text') ? [textSpan] : [];
    (viewModel as unknown as Record<string, unknown>)['querySelector'] = (sel: string) =>
      sel.includes('#author-text') || sel.includes('author-text') ? authorNode : null;
    (viewModel as unknown as Record<string, unknown>)['getAttribute'] = () => null;
    const root = { querySelectorAll: () => [viewModel] };

    const adapter = new YouTubeAdapter({ root: root as never });
    const comments = adapter.extractComments();
    expect(comments).toHaveLength(1);
    expect(comments[0].text).toBe('modern youtube comment');
    expect(comments[0].author).toBe('modern_author');
  });

  test('queryAll pierces nested shadow hosts (renderer shadow -> inner view-model shadow)', () => {
    const textNode = new FakeEl('span');
    textNode.textContent = 'deeply nested comment';
    const innerShadow = {
      querySelectorAll: (sel: string) => (sel.includes('content-text') ? [textNode] : []),
      querySelector: () => null,
    };
    const innerHost = new FakeEl('ytd-comment-view-model');
    tag(innerHost, 'YTD-COMMENT-VIEW-MODEL');
    (innerHost as unknown as Record<string, unknown>)['shadowRoot'] = innerShadow;
    (innerHost as unknown as Record<string, unknown>)['querySelectorAll'] = () => [];
    const outerShadow = {
      // The outer shadow root only exposes the inner host, not the text node.
      // (Mirrors real DOM: '*' returns all descendants of the shadow tree.)
      querySelectorAll: (sel: string) =>
        sel === '*' || sel.includes('view-model') ? [innerHost] : [],
      querySelector: () => null,
    };
    const outer = new FakeEl('ytd-comment-renderer');
    tag(outer, 'YTD-COMMENT-RENDERER');
    (outer as unknown as Record<string, unknown>)['shadowRoot'] = outerShadow;
    (outer as unknown as Record<string, unknown>)['querySelectorAll'] = () => [];
    (outer as unknown as Record<string, unknown>)['querySelector'] = () => null;

    expect(queryAll(outer as never, '#content-text')).toContain(textNode);
  });
});
