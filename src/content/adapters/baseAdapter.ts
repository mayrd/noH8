import type { CommentData, AnalysisResult } from '../../shared/types';
import type { UiElement } from '../../shared/uiTypes';

export abstract class BaseAdapter {
  abstract platformName: string;

  /**
   * Host match patterns (Chrome match patterns) describing the domains/pages
   * this adapter should parse when opened in the browser. Must be covered by
   * the manifest's `host_permissions` / `optional_host_permissions`.
   */
  abstract hostPermissions: string[];

  abstract extractComments(): CommentData[];
  abstract injectWarning(commentId: string, result: AnalysisResult): void;

  /**
   * Observe the page for newly added comments (infinite scroll, thread
   * expansion, SPA navigation).
   *
   * L3: also watches for comment composers matching
   * `commentTextareaSelector`. The optional `onComposersFound` callback fires
   * with exactly the composers that appeared since the previous scan
   * (deduped, so SPA re-renders yield a fresh button per composer but never
   * duplicates). Adapters without a composer selector never fire it.
   */
  abstract observe(
    onNewCommentsFound: (comments: CommentData[]) => void,
    onComposersFound?: (composers: UiElement[]) => void
  ): void;

  /**
   * List the currently rendered comment-composer elements (textareas /
   * contenteditables matching `commentTextareaSelector`). Empty when the
   * adapter has no composer selector or no root. Used by `observe()` and by
   * the content-script boot scan.
   */
  abstract extractComposers(): UiElement[];

  /**
   * Optional CSS selector for a platform-specific anchor element inside the
   * comment container (e.g. Instagram's heart/like button) beneath which the
   * rainbow NoH8 button is placed.
   *
   * When unset, the rainbow button is appended to the comment container
   * (default behavior).
   */
  commentAnchorSelector?: string;

  /**
   * Optional CSS selector for a platform-specific textarea / contenteditable
   * element where the user composes new comments (i.e. the comment "draft"
   * box). When the "review own comment drafts" setting is enabled, a rainbow
   * button is placed next to every element matching this selector so the user
   * can review their draft before posting.
   *
   * When unset, no draft-review button is rendered for this platform.
   */
  commentTextareaSelector?: string;

  constructor() {
    if (new.target === BaseAdapter) {
      throw new Error('BaseAdapter is abstract and cannot be instantiated directly.');
    }
  }
}
