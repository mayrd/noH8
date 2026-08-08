import { BaseAdapter } from './baseAdapter';
import type { CommentData, AnalysisResult } from '../../shared/types';

export default class TikTokAdapter extends BaseAdapter {
  platformName = 'tiktok' as const;

  extractComments(): CommentData[] {
    // Parses TikTok video comment sections
    return [];
  }

  injectWarning(commentId: string, result: AnalysisResult): void {
    // Injects a warning banner onto the comment element
  }

  observe(onNewCommentsFound: (comments: CommentData[]) => void): void {
    // Sets up a MutationObserver for TikTok's dynamic feed
  }
}