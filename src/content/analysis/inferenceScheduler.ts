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
 * - **Parent-before-child ordering (M14):** a reply carrying a `parentId` is
 *   deferred until its parent is scheduled, so the parent is analysed (and
 *   cached) before the reply is scored with conversational context.
 *
 * Pure and dependency-injected: the inference function is supplied by the
 * caller, so unit tests can drive it with mocks and the content script wires
 * in `inferComment`.
 */

/**
 * Input shape the scheduler passes through to the inference function.
 *
 * The `parentText` / `depth` / `parentId` fields (M14) carry reply-thread
 * context: `parentText` so the inference function can prepend the parent turn,
 * and `parentId` so the scheduler can order parents ahead of their replies.
 */
export interface SchedulableComment {
  commentId: string;
  text: string;
  /** (M14) Parent comment text prepended to the model input for context. */
  parentText?: string;
  /** (M14) Nesting depth: 0 = top-level, 1 = direct reply, etc. */
  depth?: number;
  /** (M14) Parent comment id used for parent-before-child scheduling. */
  parentId?: string;
}

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
  // Carry the full comment (incl. parentText) so the infer function can score
  // the reply with its parent's text when present.
  return { comment, key: cacheKeyFor(comment), resolve, reject, promise };
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
  /**
   * Comment ids that have been scheduled at least once. A reply whose parent
   * id is missing from this set is deferred until the parent is scheduled.
   */
  const scheduledIds = new Set<string>();
  /**
   * Replies waiting on a parent that hasn't been scheduled yet, keyed by the
   * parent's comment id. Released when the parent is scheduled.
   */
  const pendingChildren = new Map<string, Job[]>();
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
        // Release any replies that were deferred pending this parent.
        releasePendingChildren(job.comment.commentId);
      });
  }

  function pump(): void {
    while (running < concurrency && queue.length > 0) {
      const job = queue.shift();
      if (!job) break;
      run(job);
    }
  }

  /**
   * Enqueue a job, inserting it right after its parent (if the parent is still
   * queued) so parents are always drained before their replies.
   */
  function enqueue(job: Job): void {
    jobs.set(job.key, job);
    const parentId = job.comment.parentId;
    if (parentId) {
      const parentIdx = queue.findIndex((j) => j.comment.commentId === parentId);
      if (parentIdx !== -1) {
        queue.splice(parentIdx + 1, 0, job);
        return;
      }
    }
    queue.push(job);
  }

  /** Enqueue every reply deferred for `parentId`, in arrival order. */
  function releasePendingChildren(parentId: string): void {
    const waiting = pendingChildren.get(parentId);
    if (!waiting) return;
    pendingChildren.delete(parentId);
    for (const child of waiting) enqueue(child);
    pump();
  }

  return {
    schedule(comment: SchedulableComment): Promise<CommentAnalysis> {
      const key = cacheKeyFor(comment);

      const cached = cache.get(key);
      if (cached) return Promise.resolve(cached);

      const existing = jobs.get(key);
      if (existing) return existing.promise;

      const job = createJob(comment);
      scheduledIds.add(comment.commentId);

      // Parent-before-child (M14): defer a reply until its parent has been
      // scheduled, so the parent is analysed (and cached) first.
      if (comment.parentId && !scheduledIds.has(comment.parentId)) {
        const waiting = pendingChildren.get(comment.parentId) || [];
        waiting.push(job);
        pendingChildren.set(comment.parentId, waiting);
        return job.promise;
      }

      enqueue(job);
      pump();

      // If anything was deferred waiting for THIS comment, release it now.
      releasePendingChildren(comment.commentId);

      return job.promise;
    },

    pendingCount(): number {
      let deferred = 0;
      for (const jobs of pendingChildren.values()) deferred += jobs.length;
      return queue.length + running + deferred;
    },

    clearCache(): void {
      cache.clear();
    },
  };
}


