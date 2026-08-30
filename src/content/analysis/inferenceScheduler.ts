import type { CommentAnalysis } from '../../shared/types';

/**
 * Inference scheduler for the content script (M10 — scan performance).
 *
 * Adapter observers can surface bursts of comments at once (infinite scroll,
 * thread expansion). Flooding the offscreen Transformers.js pipeline with
 * concurrent requests wastes memory and can starve the WASM runtime, and
 * re-scans would re-infer comments that were already analysed.
 *
 * This module sits between the observers and `inferComment` and provides:
 * - **Concurrency limiting:** at most `concurrency` inferences run at once;
 *   the rest wait in a FIFO queue.
 * - **Deduplication:** concurrent schedules for the same comment share a
 *   single in-flight inference.
 * - **Result caching:** completed analyses are cached by
 *   `commentId::text` so rescans never re-infer identical comments. Failed
 *   inferences are never cached (the next schedule retries), and
 *   `clearCache()` resets everything.
 *
 * Pure and dependency-injected: the inference function is supplied by the
 * caller, so unit tests can drive it with mocks and the content script wires
 * in `inferComment`.
 */

/** Input shape the scheduler passes through to the inference function. */
export type SchedulableComment = Pick<CommentAnalysis, 'commentId'> & { text: string };

export interface SchedulerOptions {
  /** The (async) inference implementation to run for each unique comment. */
  infer: (comment: SchedulableComment) => Promise<CommentAnalysis>;
  /** Maximum number of concurrent inferences. Defaults to 2. */
  concurrency?: number;
}

export interface InferenceScheduler {
  /** Queue (or cache-serve) the analysis for a comment. */
  schedule: (comment: SchedulableComment) => Promise<CommentAnalysis>;
  /** Number of jobs queued or currently in flight (cache hits excluded). */
  pendingCount: () => number;
  /** Drop all cached results; subsequent schedules re-infer. */
  clearCache: () => void;
}

/** Stable identity for a comment's analysis: id plus the analysed text. */
function cacheKeyFor(comment: SchedulableComment): string {
  return `${comment.commentId}::${comment.text}`;
}

/** A queued or running unit of inference work. */
interface Job {
  comment: SchedulableComment;
  key: string;
  resolve: (analysis: CommentAnalysis) => void;
  reject: (reason?: unknown) => void;
  promise: Promise<CommentAnalysis>;
}

function createJob(comment: SchedulableComment): Job {
  let resolve!: (analysis: CommentAnalysis) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<CommentAnalysis>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { comment: { commentId: comment.commentId, text: comment.text }, key: cacheKeyFor(comment), resolve, reject, promise };
}

/**
 * Create a concurrency-limited, deduplicating scheduler around `infer`.
 */
export function createInferenceScheduler(options: SchedulerOptions): InferenceScheduler {
  const infer = options.infer;
  const concurrency = Math.max(1, options.concurrency ?? 2);

  /** Completed results, served without calling `infer` again. */
  const cache = new Map<string, CommentAnalysis>();
  /** In-flight or queued schedules, shared between duplicate callers. */
  const jobs = new Map<string, Job>();
  const queue: Job[] = [];
  let running = 0;

  function run(job: Job): void {
    running += 1;
    infer(job.comment)
      .then((analysis) => {
        cache.set(job.key, analysis);
        job.resolve(analysis);
      })
      .catch((reason: unknown) => {
        // Failed inferences are never cached: the next schedule retries.
        job.reject(reason);
      })
      .finally(() => {
        running -= 1;
        jobs.delete(job.key);
        pump();
      });
  }

  function pump(): void {
    while (running < concurrency && queue.length > 0) {
      const job = queue.shift();
      if (!job) break;
      run(job);
    }
  }

  return {
    schedule(comment: SchedulableComment): Promise<CommentAnalysis> {
      const key = cacheKeyFor(comment);

      const cached = cache.get(key);
      if (cached) return Promise.resolve(cached);

      const existing = jobs.get(key);
      if (existing) return existing.promise;

      const job = createJob(comment);
      jobs.set(key, job);
      queue.push(job);
      pump();
      return job.promise;
    },

    pendingCount(): number {
      return queue.length + running;
    },

    clearCache(): void {
      cache.clear();
    },
  };
}

