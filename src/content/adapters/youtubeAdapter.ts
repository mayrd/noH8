import { BaseAdapter } from './baseAdapter';
import type { CommentData } from '../../shared/types';
import { getMatchesForPlatform } from '../platformConfig';

export default class YouTubeAdapter extends BaseAdapter {
  platformName = 'youtube' as const;

  /** Domains/pages this adapter parses when opened in the browser. */
  hostPermissions: string[] = getMatchesForPlatform(this.platformName);

  extractComments(): CommentData[] {
    // In a real implementation, this would parse the DOM for YouTube comments
    return [];
  }

  injectWarning(commentId: string, result: { isHateSpeech: boolean; score: number; label: string }): void {
    // In a real implementation, this would inject UI elements into the DOM
    console.log(`[YouTube] Comment ${commentId}: ${result.label} (${result.score})`);
  }

  observe(onNewCommentsFound: (comments: CommentData[]) => void): void {
    // In a real implementation, this would set up a MutationObserver for YouTube
    // For now, we just call the callback with an empty array to satisfy the interface
    onNewCommentsFound([]);
  }
}