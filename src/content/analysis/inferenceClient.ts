import type { CommentAnalysis, CommentData } from '../../shared/types';
import { requestAnalyze } from '../../offscreen/client';
import { analyzeCommentText } from './sentimentAnalyzer';

/**
 * Content-script analysis entry point.
 *
 * Prefers the on-device Transformers.js pipeline running in the offscreen
 * document. If the model pipeline is unavailable (e.g. still downloading,
 * browser without offscreen support, or any runtime error) it transparently
 * falls back to the deterministic heuristic analyser so every comment is still
 * scored and the page is never blocked.
 */
export async function inferComment(
  comment: Pick<CommentData, 'id' | 'text'>
): Promise<CommentAnalysis> {
  try {
    const result = await requestAnalyze(comment.text, comment.id);
    return { ...result, commentId: comment.id };
  } catch {
    return analyzeCommentText(comment);
  }
}