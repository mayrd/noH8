import { BaseAdapter } from './baseAdapter';
import type { CommentData, AnalysisResult } from '../../shared/types';
import { getMatchesForPlatform } from '../platformConfig';
import {
  selectCommentContainers,
  type CommentSelectors,
} from './selectorStrategy';
import { findParsedAncestor, type ParsedCommentInfo } from './replyContext';

/**
 * Structural DOM interfaces. These keep the adapter decoupled from the real
 * DOM so its logic can be unit tested in Node without jsdom. The real DOM
 * (`Element`, `Document`, `MutationObserver`) satisfies them structurally.
 */
import type { UiElement } from '../../shared/uiTypes';

/** Structural element type — single source of truth in shared/uiTypes.ts. */
export type ElementLike = UiElement;

interface RootLike {
  querySelectorAll(selector: string): ElementLike[] | NodeListOf<Element>;
}

interface DocumentLike {
  createElement(tagName: string): ElementLike;
}

type MutationObserverCtor = new (callback: () => void) => {
  observe(target: unknown, options?: unknown): void;
  disconnect(): void;
};

const NoopMutationObserver = class {
  observe(_target: unknown, _options?: unknown): void {}
  disconnect(): void {}
} as MutationObserverCtor;

/**
 * Instagram DOM selector strategy.
 *
 * Instagram obfuscates its class names and frequently re-skips, so we lean on
 * structural + `role`/`dir` attributes rather than stable class names where
 * possible, and keep class-based selectors as documented fallbacks.
 */
const SIG_ROLE_CONTENTINFO = 'li[role="contentinfo"][dir]';
const SIG_FEED_LIST_ITEM = 'div[role="article"] ul li[dir]';
const SIG_MODAL_LIST_ITEM = 'div[role="dialog"] ul[role="list"] > li';

/** Primary selectors tried first when locating comment containers. */
const COMMENT_PRIMARY_SELECTORS = [SIG_ROLE_CONTENTINFO];
/** Fallback selectors tried (only) when the primary selectors yield nothing. */
const COMMENT_SECONDARY_SELECTORS = [SIG_FEED_LIST_ITEM, SIG_MODAL_LIST_ITEM];

/** Selector used to grab the author handle from a comment container. */
const AUTHOR_SELECTOR =
  'a[href^="/"], a[href^="https://www.instagram.com/"], span[dir="auto"]';

/**
 * Instagram labels each comment's heart/like button with a localized
 * `aria-label` (e.g. "Like" / "Unlike" in English). We match the button owning
 * that label so the rainbow NoH8 button can be anchored beneath it. Class
 * names are intentionally avoided — Instagram obfuscates them aggressively.
 */
const HEART_BUTTON_SELECTOR =
  'button[aria-label*="like" i], [role="button"][aria-label*="like" i]';

/**
 * Selector for the textarea / contenteditable element where the user composes
 * a new comment. Instagram's comment composer uses a `textarea` (often with
 * a placeholder containing "comment") inside the comment form.
 */
const COMMENT_TEXTAREA_SELECTOR =
  'textarea[placeholder*="comment" i], textarea, [role="textbox"][contenteditable="true"]';

interface InstagramAdapterOptions {
  root?: RootLike | null;
  document?: DocumentLike | null;
  MutationObserver?: MutationObserverCtor | null;
}

export default class InstagramAdapter extends BaseAdapter {
  /** Selectors exposed for reuse/customisation and used by the unit tests. */
  static readonly selectors: CommentSelectors = {
    primary: COMMENT_PRIMARY_SELECTORS,
    secondary: COMMENT_SECONDARY_SELECTORS,
  };
  static readonly commentTextSelector = 'span[dir="auto"]';
  static readonly authorSelector = AUTHOR_SELECTOR;
  static readonly heartButtonSelector = HEART_BUTTON_SELECTOR;
  commentAnchorSelector = InstagramAdapter.heartButtonSelector;

  platformName = 'instagram' as const;

  /** Selector identifying the comment composer textarea(s). */
  static readonly commentTextareaSelector = COMMENT_TEXTAREA_SELECTOR;
  commentTextareaSelector = InstagramAdapter.commentTextareaSelector;

  /** Domains/pages this adapter parses when opened in the browser. */
  hostPermissions: string[] = getMatchesForPlatform(this.platformName);

  private readonly root: RootLike | null;
  private readonly documentRef: DocumentLike | null;
  private readonly MutationObserverCtor: MutationObserverCtor;
  private readonly commentElements = new Map<string, ElementLike>();
  /** (M14) Already-parsed comments keyed by element, for reply-context resolution. */
  private readonly parsedByElement = new Map<ElementLike, ParsedCommentInfo>();
  private mutationObserver: { disconnect(): void } | null = null;

  constructor(options: InstagramAdapterOptions = {}) {
    super();
    const hasDocument = typeof document !== 'undefined' ? document : null;
    this.root = options.root !== undefined ? options.root : hasDocument;
    this.documentRef = options.document !== undefined ? options.document : hasDocument;
    const globalMO =
      typeof MutationObserver !== 'undefined' ? MutationObserver : NoopMutationObserver;
    this.MutationObserverCtor = options.MutationObserver ?? globalMO;
  }

  private queryAll(el: RootLike | ElementLike, selector: string): ElementLike[] {
    const list = el.querySelectorAll(selector);
    return Array.from(list as ArrayLike<ElementLike>);
  }

  private hash(input: string): string {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 33) ^ input.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  private resolveAuthor(item: ElementLike): string {
    const anchor = item.querySelector?.(AUTHOR_SELECTOR);
    return (anchor?.textContent ?? '').trim() || 'unknown';
  }

  private resolveId(item: ElementLike, author: string, text: string): string {
    const attr =
      item.getAttribute?.('id') || item.getAttribute?.('data-comment-id');
    if (attr) return attr;
    return `instagram-${this.hash(author + text)}`;
  }
  private parseComment(item: ElementLike): CommentData | null {
    const text =
      this.queryAll(item, InstagramAdapter.commentTextSelector)
        .map((node) => (node.textContent ?? '').trim())
        .find((candidate) => candidate.length > 0) ?? '';
    if (!text) return null;

    const author = this.resolveAuthor(item);
    const id = this.resolveId(item, author, text);
    this.commentElements.set(id, item);

    // M14: Instagram nests replies inside the parent comment's container
    // subtree, so the nearest already-parsed enclosing element is the parent.
    const parent = findParsedAncestor(item, this.parsedByElement);
    const depth = parent ? parent.depth + 1 : undefined;
    this.parsedByElement.set(item, { id, text, depth: depth ?? 0 });

    return {
      id,
      platform: this.platformName,
      author,
      text,
      ...(parent ? { parentId: parent.id, parentText: parent.text, depth } : {}),
      elementRef: item,
    };
  }

  /** Parses the Instagram DOM for top-level and nested comments. */
  extractComments(): CommentData[] {
    if (!this.root) return [];

    const items = selectCommentContainers(this.root, InstagramAdapter.selectors);
    const comments: CommentData[] = [];
    for (const item of items) {
      const comment = this.parseComment(item);
      if (comment) comments.push(comment);
    }
    return comments;
  }

  /**
   * List the currently rendered comment composers (L3). Uses the adapter's
   * `commentTextareaSelector` — never a hard-coded selector.
   */
  extractComposers(): ElementLike[] {
    if (!this.root || !this.commentTextareaSelector) return [];
    try {
      const list = this.root.querySelectorAll(this.commentTextareaSelector);
      return Array.from(list as ArrayLike<ElementLike>);
    } catch {
      return [];
    }
  }

  private percent(score: number): string {
    return `${Math.round(Math.min(1, Math.max(0, score)) * 100)}%`;
  }

  /** Injects a warning banner onto the comment element. */
  injectWarning(commentId: string, result: AnalysisResult): void {
    const target = this.commentElements.get(commentId);
    if (!target || !this.documentRef) return;
    // Skip if a warning is already attached to avoid duplicated banners.
    if (this.queryAll(target, '[data-noh8-warning]').length > 0) return;

    const banner = this.documentRef.createElement('div');
    banner.setAttribute?.('data-noh8-warning', 'true');
    banner.setAttribute?.(
      'class',
      'noh8-comment-warning noh8-comment-warning--flagged'
    );
    banner.textContent = `⚠ Hate speech detected: ${result.label} (${this.percent(
      result.score
    )} confidence)`;
    target.appendChild?.(banner);
  }

  /** Watches the DOM for infinite scroll / dynamically added comments. */
  observe(
    onNewCommentsFound: (comments: CommentData[]) => void,
    onComposersFound?: (composers: ElementLike[]) => void
  ): void {
    // Start from an empty set so the first scan reports any existing comments.
    const seen = new Set<string>();
    // L3: composer dedup — the same set of elements re-scanned never re-fires.
    const seenComposers = new Set<ElementLike>();

    const scan = (): void => {
      const fresh: CommentData[] = [];
      for (const comment of this.extractComments()) {
        if (seen.has(comment.id)) continue;
        seen.add(comment.id);
        fresh.push(comment);
      }
      if (fresh.length > 0) onNewCommentsFound(fresh);

      // L3: report exactly the composers that appeared since the previous
      // scan so SPA re-renders yield a fresh button per composer, never
      // duplicates.
      if (onComposersFound) {
        const freshComposers = this.extractComposers().filter((el) => !seenComposers.has(el));
        for (const el of freshComposers) seenComposers.add(el);
        if (freshComposers.length > 0) onComposersFound(freshComposers);
      }
    };

    // Report anything already rendered on first boot.
    scan();

    const observer = new this.MutationObserverCtor(scan);
    this.mutationObserver = observer;
    if (this.root) {
      observer.observe(this.root, { childList: true, subtree: true });
    }
  }
}