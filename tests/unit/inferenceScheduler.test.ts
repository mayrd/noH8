import { describe, test, expect, vi } from 'vitest';
import type { CommentAnalysis } from '../../src/shared/types';
import { createInferenceScheduler } from '../../src/content/analysis/inferenceScheduler';

type InferInput = Pick<CommentAnalysis, 'commentId'> & { text: string };

function analysisFor(id: string, hate = false): CommentAnalysis {
  return {
    commentId: id,
    sentiment: { score: 0, label: 'neutral' },
    isHateSpeech: hate,
    hateSpeechScore: hate ? 0.9 : 0,
    issues: [],
  };
}

/** Deferred promise helper for hand-driving the mocked infer fn. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Drain enough microtask ticks for resolve → finally → pump chains. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

describe('inferenceScheduler', () => {
  test('resolves with the infer result for a scheduled comment', async () => {
    const infer = vi.fn(async (input: InferInput) => analysisFor(input.commentId));
    const scheduler = createInferenceScheduler({ infer });

    await expect(scheduler.schedule({ commentId: 'c1', text: 'hello' })).resolves.toEqual(
      analysisFor('c1')
    );
    expect(infer).toHaveBeenCalledOnce();
  });

  test('never runs more than `concurrency` inferences in flight', async () => {
    const gates = [deferred(), deferred(), deferred(), deferred()];
    let started = 0;
    const infer = vi.fn((input: InferInput) => {
      const gate = gates[started++];
      return gate.promise.then(() => analysisFor(input.commentId));
    });
    const scheduler = createInferenceScheduler({ infer, concurrency: 2 });

    const results = [
      scheduler.schedule({ commentId: 'c1', text: 'a' }),
      scheduler.schedule({ commentId: 'c2', text: 'b' }),
      scheduler.schedule({ commentId: 'c3', text: 'c' }),
      scheduler.schedule({ commentId: 'c4', text: 'd' }),
    ];

    // Only 2 in flight while the first two are blocked.
    expect(infer).toHaveBeenCalledTimes(2);
    gates[0].resolve();
    await flushMicrotasks();
    expect(infer).toHaveBeenCalledTimes(3);
    gates[1].resolve();
    await flushMicrotasks();
    expect(infer).toHaveBeenCalledTimes(4);

    gates[2].resolve();
    gates[3].resolve();
    await Promise.all(results);
    expect(infer).toHaveBeenCalledTimes(4);
  });

  test('starts queued work in FIFO order', async () => {
    const order: string[] = [];
    const infer = vi.fn(async (input: InferInput) => {
      order.push(input.commentId);
      return analysisFor(input.commentId);
    });
    const scheduler = createInferenceScheduler({ infer, concurrency: 1 });

    const results = [
      scheduler.schedule({ commentId: 'c1', text: 'a' }),
      scheduler.schedule({ commentId: 'c2', text: 'b' }),
      scheduler.schedule({ commentId: 'c3', text: 'c' }),
    ];
    await Promise.all(results);
    expect(order).toEqual(['c1', 'c2', 'c3']);
  });

  test('concurrent duplicate comments share a single inference', async () => {
    const infer = vi.fn(async (input: InferInput) => analysisFor(input.commentId, true));
    const scheduler = createInferenceScheduler({ infer });

    const [a, b] = await Promise.all([
      scheduler.schedule({ commentId: 'c1', text: 'same text' }),
      scheduler.schedule({ commentId: 'c1', text: 'same text' }),
    ]);

    expect(infer).toHaveBeenCalledOnce();
    expect(a).toBe(b); // both callers receive the identical result object
    expect(a.isHateSpeech).toBe(true);
  });

  test('a completed comment is served from cache without re-inferring', async () => {
    const infer = vi.fn(async (input: InferInput) => analysisFor(input.commentId));
    const scheduler = createInferenceScheduler({ infer });

    const first = await scheduler.schedule({ commentId: 'c1', text: 'hello' });
    const second = await scheduler.schedule({ commentId: 'c1', text: 'hello' });

    expect(infer).toHaveBeenCalledOnce();
    expect(second).toBe(first);
  });

  test('cache key includes the text so an edited comment is re-inferred', async () => {
    const infer = vi.fn(async (input: InferInput) => analysisFor(input.commentId));
    const scheduler = createInferenceScheduler({ infer });

    await scheduler.schedule({ commentId: 'c1', text: 'first version' });
    await scheduler.schedule({ commentId: 'c1', text: 'edited version' });

    expect(infer).toHaveBeenCalledTimes(2);
  });

  test('a failing job rejects its own promise and does not block the queue', async () => {
    const infer = vi.fn(async (input: InferInput) => {
      if (input.commentId === 'bad') throw new Error('pipeline down');
      return analysisFor(input.commentId);
    });
    const scheduler = createInferenceScheduler({ infer, concurrency: 1 });

    const failing = scheduler.schedule({ commentId: 'bad', text: 'a' });
    const good = scheduler.schedule({ commentId: 'good', text: 'b' });

    await expect(failing).rejects.toThrow('pipeline down');
    await expect(good).resolves.toEqual(analysisFor('good'));
    expect(infer).toHaveBeenCalledTimes(2);
  });


  test('a failed inference is not cached — retry re-infers', async () => {
    const infer = vi
      .fn<(input: InferInput) => Promise<CommentAnalysis>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(analysisFor('c1'));

    const scheduler = createInferenceScheduler({ infer });
    await expect(scheduler.schedule({ commentId: 'c1', text: 'x' })).rejects.toThrow('boom');
    await expect(scheduler.schedule({ commentId: 'c1', text: 'x' })).resolves.toEqual(
      analysisFor('c1')
    );
    expect(infer).toHaveBeenCalledTimes(2);
  });

  test('pendingCount tracks queued + in-flight work', async () => {
    const gate = deferred();
    const infer = vi.fn((input: InferInput) =>
      gate.promise.then(() => analysisFor(input.commentId))
    );
    const scheduler = createInferenceScheduler({ infer, concurrency: 1 });

    const a = scheduler.schedule({ commentId: 'c1', text: 'a' });
    const b = scheduler.schedule({ commentId: 'c2', text: 'b' });
    expect(scheduler.pendingCount()).toBe(2);

    gate.resolve();
    await flushMicrotasks();
    await Promise.all([a, b]);
    expect(scheduler.pendingCount()).toBe(0);
  });

  test('clearCache drops cached results so the next schedule re-infers', async () => {
    const infer = vi.fn(async (input: InferInput) => analysisFor(input.commentId));
    const scheduler = createInferenceScheduler({ infer });

    await scheduler.schedule({ commentId: 'c1', text: 'hello' });
    await flushMicrotasks();
    scheduler.clearCache();
    await scheduler.schedule({ commentId: 'c1', text: 'hello' });
    expect(infer).toHaveBeenCalledTimes(2);
  });
});
