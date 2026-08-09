import { describe, test, expect, vi, beforeEach } from 'vitest';

const runtimeSend = vi.fn();

global.chrome = { runtime: { sendMessage: runtimeSend } } as any;

import { requestAnalyze, requestModelCommand } from '../../src/offscreen/client';
import { MSG } from '../../src/shared/messages';

function lastRequest(): any {
  return runtimeSend.mock.calls[runtimeSend.mock.calls.length - 1][0];
}

describe('offscreen client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeSend.mockImplementation((_msg: unknown, cb: (resp: unknown) => void) => {
      cb({ ok: true, data: 'ok' });
    });
  });

  test('requestAnalyze posts a typed analyze request with the comment text', async () => {
    await requestAnalyze('hello');
    expect(lastRequest().type).toBe(MSG.ANALYZE);
    expect(lastRequest().text).toBe('hello');
    expect(lastRequest().requestId).toBeTruthy();
  });

  test('requestAnalyze resolves with the returned analysis data', async () => {
    const data = { commentId: 'c1' };
    runtimeSend.mockImplementation((_msg, cb) => cb({ ok: true, data }));
    await expect(requestAnalyze('x')).resolves.toEqual(data);
  });

  test('requestAnalyze throws when the pipeline reports an error', async () => {
    runtimeSend.mockImplementation((_msg, cb) =>
      cb({ ok: false, error: 'model not loaded' })
    );
    await expect(requestAnalyze('x')).rejects.toThrow('model not loaded');
  });

  test('requestAnalyze falls back to an error when chrome.runtime is unavailable', async () => {
    // Simulate no runtime by making sendMessage throw synchronously.
    runtimeSend.mockImplementation(() => {
      throw new Error('broken');
    });
    // The helper should still reject rather than hang.
    await expect(requestAnalyze('x')).rejects.toBeTruthy();
  });

  test('requestModelCommand maps kind to the matching message type', async () => {
    await requestModelCommand('download', 'toxic-bert');
    expect(lastRequest().type).toBe(MSG.DOWNLOAD);
    expect(lastRequest().modelId).toBe('toxic-bert');

    await requestModelCommand('delete', 'toxic-bert');
    expect(lastRequest().type).toBe(MSG.DELETE);

    await requestModelCommand('refresh', 'toxic-bert');
    expect(lastRequest().type).toBe(MSG.REFRESH);
  });

  test('requestModelCommand throws when the command fails', async () => {
    runtimeSend.mockImplementation((_msg, cb) =>
      cb({ ok: false, error: 'download failed' })
    );
    await expect(requestModelCommand('download', 'toxic-bert')).rejects.toThrow(
      'download failed'
    );
  });
});