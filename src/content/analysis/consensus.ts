import type { CommentAnalysis, DetectedIssue, ModelVerdict } from '../../shared/types';

/**
 * Multi-model consensus merge (M17 — detection quality).
 *
 * A single model is a single point of failure for both false positives and
 * false negatives: one over-eager model flags clean comments, one blind model
 * misses abuse. Consensus requires *quorum* models to flag before the merged
 * result flags (unanimous by default — i.e. both models for the standard
 * primary+secondary pair). Every model's individual verdict travels with the
 * merged result (`perModel`) so the analysis modal can show the per-model
 * scores and any disagreement stays inspectable.
 *
 * Pure and dependency-free: no DOM, `chrome.*`, catalog, or ML surface here —
 * the offscreen pipeline (`offscreen/inference.ts`) supplies already-computed
 * `CommentAnalysis` payloads plus model identity.
 */

/** One model's opinion entering the consensus merge. */
export interface ConsensusInput {
  /** The model's already-computed analysis for the comment. */
  analysis: CommentAnalysis;
  /** Stable catalog id, recorded into the merged `perModel` verdicts. */
  modelId: string;
  /**
   * Human-readable model name for the modal. `ModelVerdict.modelName` is
   * optional, so inputs may omit it (verdicts then carry `undefined`).
   */
  modelName?: string;
}


/** Stable identity for a `DetectedIssue` within a merged issue set. */
function issueKey(issue: DetectedIssue): string {
  return issue.id;
}

/**
 * Merge several per-model analyses under a quorum rule: the merged result is
 * flagged only when at least `quorum` models flag (default: unanimous). The
 * consensus confidence is the *weakest* member (`min` over all scores), so a
 * surviving score is always consistent with the flag (flagged implies every
 * contributing score crossed its model's threshold too); the consensus
 * sentiment is the least-negative reading, since the merge must not assert
 * negativity the models don't agree on.
 *
 * Verdicts and issues: `perModel` always records every input verdict;
 * non-hate issues are unioned (deduped by id); the `hate_speech` issue is
 * dropped when the consensus does not flag.
 */
export function mergeConsensus(
  inputs: readonly ConsensusInput[],
  quorum: number = inputs.length
): CommentAnalysis {
  if (inputs.length === 0) {
    throw new Error('mergeConsensus requires at least one per-model analysis');
  }
  const required = Math.max(1, Math.min(quorum, inputs.length));
  const flagged = inputs.filter((input) => input.analysis.isHateSpeech);

  const isHateSpeech = flagged.length >= required;
  const hateSpeechScore = Math.min(
    ...inputs.map((input) => input.analysis.hateSpeechScore)
  );

  const seen = new Set<string>();
  const issues: DetectedIssue[] = [];
  for (const input of inputs) {
    for (const issue of input.analysis.issues) {
      // No consensus flag — neither model may leave a hate claim standing.
      if (issue.id === 'hate_speech' && !isHateSpeech) continue;
      const key = issueKey(issue);
      if (!seen.has(key)) {
        seen.add(key);
        issues.push(issue);
      }
    }
  }

  const sentiments = inputs.map((input) => input.analysis.sentiment);
  const sentiment = sentiments.reduce((a, b) => (a.score >= b.score ? a : b));

  const perModel: ModelVerdict[] = inputs.map((input) => ({
    modelId: input.modelId,
    modelName: input.modelName,
    isHateSpeech: input.analysis.isHateSpeech,
    hateSpeechScore: input.analysis.hateSpeechScore,
    sentimentScore: input.analysis.sentiment.score,
  }));

  return {
    commentId: inputs[0].analysis.commentId,
    sentiment,
    isHateSpeech,
    hateSpeechScore,
    issues,
    perModel,
  };
}

/**
 * Decide whether consensus scoring applies for the current model state:
 * a distinct secondary model must be configured *and* downloaded, since
 * consensus needs two live pipelines. Anything else is null and the pipeline
 * stays on the single-model path.
 */
export function resolveConsensusModelId(options: {
  primaryModelId: string;
  secondaryModelId: string | null | undefined;
  downloadedModels?: readonly string[];
}): string | null {
  const { primaryModelId, secondaryModelId, downloadedModels } = options;
  if (!secondaryModelId) return null;
  if (secondaryModelId === primaryModelId) return null;
  if (!downloadedModels?.includes(secondaryModelId)) return null;
  return secondaryModelId;
}

/**
 * Stable scheduler-cache key segment identifying the model configuration an
 * analysis was computed with. Consensus (two-model) and single-model results
 * for the same comment must never share a cache entry, so an active
 * consensus pair keys on `primary+secondary` while the single-model path
 * keys on the primary id alone.
 */
export function analysisModelKey(options: {
  selectedModelId: string;
  secondaryModelId?: string | null;
  downloadedModels?: readonly string[];
}): string {
  const consensusId = resolveConsensusModelId({
    primaryModelId: options.selectedModelId,
    secondaryModelId: options.secondaryModelId,
    downloadedModels: options.downloadedModels,
  });
  return consensusId ? `${options.selectedModelId}+${consensusId}` : options.selectedModelId;
}
