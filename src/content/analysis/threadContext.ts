import type { CommentAnalysis, DetectedIssue } from '../../shared/types';

/**
 * Reply-thread context analysis (M14 — thread & context analysis).
 *
 * Social-media comments are rarely read in isolation: a reply quoting an
 * insult to *denounce* it can be mistaken for hate speech, while abuse that
 * only becomes clear *in context* can be missed when the reply is scored alone.
 *
 * This module owns the two DOM-agnostic, pure pieces of that reasoning:
 *
 * 1. `truncateParentContext` — bounds the parent text prepended to a model /
 *    heuristic input so a verbose parent can't blow the token budget.
 * 2. `mergeCommentAnalyses` — the conservative "flag if *either* the reply
 *    alone or the reply-with-context crosses the threshold" merge, shared by
 *    the on-device model path (`offscreen/inference.ts`) and the heuristic
 *    fallback (`sentimentAnalyzer.ts`) so the two never disagree on merge
 *    semantics.
 *
 * Per the repository's privacy-first rule, this module performs no I/O and
 * imports no networking / ML surface — it only combines already-computed
 * `CommentAnalysis` payloads.
 */

/** Max characters of parent text prepended onto a reply's context input. */
export const MAX_PARENT_CONTEXT_LENGTH = 500;

/**
 * Truncate parent text to a safe prefix for context prepending. Keeps the
 * leading portion (the opening of the parent turn) rather than the tail, since
 * for reply threads the parent's opening lines carry the conversational
 * setup the model needs to interpret a denial.
 */
export function truncateParentContext(parentText: string): string {
  if (parentText.length <= MAX_PARENT_CONTEXT_LENGTH) return parentText;
  return parentText.slice(0, MAX_PARENT_CONTEXT_LENGTH);
}

/** Stable identity for a `DetectedIssue` within a merged issue set. */
function issueKey(issue: DetectedIssue): string {
  return issue.id;
}

/**
 * Conservatively merge a reply-only analysis with a reply-with-context
 * analysis. A comment is flagged if *either* analysis crosses the threshold
 * (false negatives are worse than false positives here — the user can dismiss
 * on the sidepanel). Scores take the max; issues are unioned (deduped by id,
 * reply-only issues first); sentiment prefers the more negative reading (the
 * context run is the one more likely to surface hidden negativity).
 */
export function mergeCommentAnalyses(
  replyOnly: CommentAnalysis,
  replyWithContext: CommentAnalysis
): CommentAnalysis {
  const isHateSpeech = replyOnly.isHateSpeech || replyWithContext.isHateSpeech;
  const hateSpeechScore = Math.max(replyOnly.hateSpeechScore, replyWithContext.hateSpeechScore);

  const seen = new Set<string>();
  const issues: DetectedIssue[] = [];
  for (const issue of [...replyOnly.issues, ...replyWithContext.issues]) {
    const key = issueKey(issue);
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(issue);
    }
  }

  const sentiment =
    replyOnly.sentiment.score <= replyWithContext.sentiment.score
      ? replyOnly.sentiment
      : replyWithContext.sentiment;

  return {
    commentId: replyOnly.commentId,
    sentiment,
    isHateSpeech,
    hateSpeechScore,
    issues,
  };
}
