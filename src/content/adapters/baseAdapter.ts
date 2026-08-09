import type { CommentData, AnalysisResult } from '../../shared/types';

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
  abstract observe(onNewCommentsFound: (comments: CommentData[]) => void): void;

  constructor() {
    if (new.target === BaseAdapter) {
      throw new Error('BaseAdapter is abstract and cannot be instantiated directly.');
    }
  }
}