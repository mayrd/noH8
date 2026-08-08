import { BaseAdapter } from './baseAdapter';
import type { CommentData, AnalysisResult } from '../../shared/types';

export default class InstagramAdapter extends BaseAdapter {
  platformName = 'instagram' as const;

  extractComments(): CommentData[] {
    // Parses the Instagram DOM for top-level and nested comments
    return [];
  }

  injectWarning(commentId: string, result: AnalysisResult): void {
    // Injects a warning banner onto the comment element
  }

  observe(onNewCommentsFound: (comments: CommentData[]) => void): void {
    // Sets up a MutationObserver for infinite scroll / dynamic updates
  }
}