import type { CommentData, AnalysisResult } from '../../shared/types';

export abstract class BaseAdapter {
  abstract platformName: string;
  abstract extractComments(): CommentData[];
  abstract injectWarning(commentId: string, result: AnalysisResult): void;
  abstract observe(onNewCommentsFound: (comments: CommentData[]) => void): void;

  constructor() {
    if (new.target === BaseAdapter) {
      throw new Error('BaseAdapter is abstract and cannot be instantiated directly.');
    }
  }
}