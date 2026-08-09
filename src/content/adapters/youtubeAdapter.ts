import { BaseAdapter } from './baseAdapter';
import type { CommentData, AnalysisResult } from '../../shared/types';
import { getMatchesForPlatform } from '../platformConfig';
import {
  selectCommentContainers,
  type CommentSelectors,
} from './selectorStrategy';

/**
 * Structural DOM interfaces. These keep the adapter decoupled from the real
 * DOM so its logic can be unit tested in Node without jsdom.
 */
export interface ElementLike {
  textContent: string | null;
  getAttribute?(name: string): string | null;
  querySelector?(selector: string): ElementLike | null;
  querySelectorAll(selector: string): ElementLike[] | NodeListOf<Element>;
  appendChild?(node: ElementLike): void;
  setAttribute?(name: string, value: string): void;
}

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
 * YouTube DOM selector strategy.
 *
 * Comments are rendered as `ytd-comment-thread-renderer` containers which hold
 * one or more `ytd-comment-renderer` nodes. We lean on YouTube's custom-element
 * tags and stable `#content-text` / `#author-text` ids rather than hashed class
 * names.
 */
const COMMENT_PRIMARY_SELECTORS = ['ytd-comment-thread-renderer'];
const COMMENT_SECONDARY_SELECTORS = ['ytd-comment-renderer'];

/** Selector used to grab the comment body text. */
const COMMENT_TEXT_SELECTOR = '#content-text';

/** Selector used to grab the author handle from a comment container. */
const AUTHOR_SELECTOR = '#author-text';

interface YouTubeAdapterOptions {
  root?: RootLike | null;
  document?: DocumentLike | null;
  MutationObserver?: MutationObserverCtor | null;
}

export default class YouTubeAdapter extends BaseAdapter {
  /** Selectors exposed for reuse/customisation and used by the unit tests. */
  static readonly selectors: CommentSelectors = {
    primary: COMMENT_PRIMARY_SELECTORS,
    secondary: COMMENT_SECONDARY_SELECTORS,
  };
  static readonly commentTextSelector = COMMENT_TEXT_SELECTOR;
  static readonly authorSelector = AUTHOR_SELECTOR;

  platformName = 'youtube' as const;

  /** Domains/pages this adapter parses when opened in the browser. */
  hostPermissions: string[] = getMatchesForPlatform(this.platformName);

  private readonly root: RootLike | null;
  private readonly documentRef: DocumentLike | null;
  private readonly MutationObserverCtor: MutationObserverCtor;
  private readonly commentElements = new Map<string, ElementLike>();
  private mutationObserver: { disconnect(): void } | null = null;

  constructor(options: YouTubeAdapterOptions = {}) {
    super();
    const hasDocument = typeof document !== 'undefined' ? document : null;
    this.root = options.root !== undefined ? options.root : hasDocument;
    this.documentRef = options.document !== undefined ? options.document : hasDocument;
    const globalMO =
      typeof MutationObserver !== 'undefined' ? MutationObserver : NoopMutationObserver;
    this.MutationObserverCtor =
      options.MutationObserver !== undefined ? options.MutationObserver : globalMO;
  }

  private queryAll(item: ElementLike | RootLike, selector: string): ElementLike[] {
    const list = item.querySelectorAll(selector);
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
    const attr = item.getAttribute?.('id') || item.getAttribute?.('data-comment-id');
    if (attr) return attr;
    return `youtube-${this.hash(author + text)}`;
  }

  private parseComment(item: ElementLike): CommentData | null {
    const text =
      this.queryAll(item, COMMENT_TEXT_SELECTOR)
        .map((node) => (node.textContent ?? '').trim())
        .find((candidate) => candidate.length > 0) ?? '';
    if (!text) return null;

    const author = this.resolveAuthor(item);
    const id = this.resolveId(item, author, text);
    this.commentElements.set(id, item);

    return {
      id,
      platform: this.platformName,
      author,
      text,
      elementRef: item as unknown as HTMLElement,
    };
  }

  /** Parses the YouTube DOM for top-level and nested comments. */
  extractComments(): CommentData[] {
    if (!this.root) return [];

    const items = selectCommentContainers(this.root, YouTubeAdapter.selectors);
    const comments: CommentData[] = [];
    for (const item of items) {
      const comment = this.parseComment(item);
      if (comment) comments.push(comment);
    }
    return comments;
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
    banner.setAttribute?.('class', 'noh8-comment-warning noh8-comment-warning--flagged');
    banner.textContent = `⚠ Hate speech detected: ${result.label} (${this.percent(
      result.score
    )} confidence)`;
    target.appendChild?.(banner);
  }

  /** Watches the DOM for infinite scroll / dynamically added comments. */
  observe(onNewCommentsFound: (comments: CommentData[]) => void): void {
    // Start from an empty set so the first scan reports any existing comments.
    const seen = new Set<string>();

    const scan = (): void => {
      const fresh: CommentData[] = [];
      for (const comment of this.extractComments()) {
        if (seen.has(comment.id)) continue;
        seen.add(comment.id);
        fresh.push(comment);
      }
      if (fresh.length > 0) onNewCommentsFound(fresh);
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
