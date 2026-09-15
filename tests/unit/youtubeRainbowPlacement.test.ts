import { describe, test, expect, vi } from 'vitest';
import YouTubeAdapter from '../../src/content/adapters/youtubeAdapter';
import {
  renderCommentControls,
  createRainbowButton,
} from '../../src/content/ui/commentUi';
import { analyzeCommentText } from '../../src/content/analysis/sentimentAnalyzer';
import { FakeEl, makeDoc } from './fakeDom';

const COMMENT = {
  id: 'youtube-abc123',
  platform: 'youtube' as const,
  author: 'tester_user',
  text: 'hello world',
};

function analysis() {
  return analyzeCommentText({ id: COMMENT.id, text: COMMENT.text });
}

describe('YouTube rainbow placement next to Reply (RED)', () => {
  test('adapter exposes a reply/action-row anchor selector', () => {
    const adapter = new YouTubeAdapter({ root: null });
    const anchor = (adapter as unknown as { commentAnchorSelector?: string })
      .commentAnchorSelector;
    expect(anchor).toBeTruthy();
    // Must target the like/dislike/reply action row.
    expect(anchor as string).toMatch(/reply-button|action-buttons|toolbar|actions/i);
  });

  test('rainbow button anchors inside shadow-DOM action row (next to Reply)', () => {
    // Real-YouTube shape: the action toolbar lives inside the renderer's
    // open shadowRoot, invisible to host-level querySelector.
    const replyBtn = new FakeEl('ytd-button-renderer');
    (replyBtn as unknown as Record<string, unknown>)['tagName'] = 'YTD-BUTTON-RENDERER';
    replyBtn.setAttribute('id', 'reply-button');
    const toolbar = new FakeEl('div');
    (toolbar as unknown as Record<string, unknown>)['tagName'] = 'DIV';
    toolbar.setAttribute('id', 'toolbar');
    toolbar.appendChild(replyBtn);
    const shadow = {
      querySelectorAll: (sel: string) => {
        if (sel.includes('reply-button')) return [replyBtn];
        if (sel.includes('toolbar')) return [toolbar];
        return [];
      },
      querySelector: (sel: string) => {
        if (sel.includes('reply-button')) return replyBtn;
        return null;
      },
    };
    const container = new FakeEl('ytd-comment-renderer');
    (container as unknown as Record<string, unknown>)['tagName'] =
      'YTD-COMMENT-RENDERER';
    (container as unknown as Record<string, unknown>)['shadowRoot'] = shadow;
    (container as unknown as Record<string, unknown>)['querySelectorAll'] = () => [];
    (container as unknown as Record<string, unknown>)['querySelector'] = () => null;

    const doc = makeDoc();
    const adapter = new YouTubeAdapter({ root: null });
    const anchor = (adapter as unknown as { commentAnchorSelector?: string })
      .commentAnchorSelector as string;

    renderCommentControls({
      container: container as never,
      comment: COMMENT,
      analysis: analysis(),
      doc,
      heartButtonSelector: anchor,
    });

    const rainbow = toolbar.findByData('noh8Rainbow');
    expect(rainbow).not.toBeNull();
    // Must be placed in the toolbar line (sibling of Reply), not appended
    // blindly to the outer comment container.
    expect(rainbow!.parentNode).toBe(toolbar);
    const idxReply = toolbar.children.indexOf(replyBtn);
    const idxRainbow = toolbar.children.indexOf(rainbow!);
    expect(idxRainbow).toBe(idxReply + 1);
  });

  test('duplicate texts from same author get unique ids (no dropped buttons)', () => {
    function makeRenderer(text: string, author: string): Record<string, unknown> {
      const textSpan = new FakeEl('span');
      textSpan.textContent = text;
      const authorNode = new FakeEl('span');
      authorNode.textContent = author;
      const el = new FakeEl('ytd-comment-renderer');
      (el as unknown as Record<string, unknown>)['tagName'] = 'YTD-COMMENT-RENDERER';
      (el as unknown as Record<string, unknown>)['querySelectorAll'] = (sel: string) =>
        sel === '#content-text' ? [textSpan] : [];
      (el as unknown as Record<string, unknown>)['querySelector'] = (sel: string) =>
        sel === '#author-text' ? authorNode : null;
      (el as unknown as Record<string, unknown>)['getAttribute'] = () => null;
      return el as unknown as Record<string, unknown>;
    }
    const r1 = makeRenderer('lol', 'same_user');
    const r2 = makeRenderer('lol', 'same_user');
    const root = {
      querySelectorAll: () => [r1, r2],
    };
    const adapter = new YouTubeAdapter({ root: root as never });
    const comments = adapter.extractComments();
    expect(comments).toHaveLength(2);
    expect(comments[0].id).not.toBe(comments[1].id);
  });

  test('rainbow button shows live (async) analysis when clicked', () => {
    const doc = makeDoc();
    const holder = { current: analysis() };
    const button = createRainbowButton(doc, COMMENT, holder as never) as unknown as FakeEl;
    // Simulate async inference finishing after optimistic render.
    holder.current = {
      ...holder.current,
      isHateSpeech: true,
      hateSpeechScore: 0.99,
    };
    button.click();
    const overlay = (doc.body as unknown as FakeEl).findByData('noh8ModalOverlay');
    expect(overlay).not.toBeNull();
    // Modal must reflect the UPDATED analysis, not the stale placeholder.
    expect(overlay!.joinedText()).toMatch(/Hate speech|99%/);
  });
});
