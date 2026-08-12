import { pipeline, env } from '@xenova/transformers';
import type { CommentAnalysis } from '../shared/types';
import {
  findModelDescriptor,
  commentAnalysisFromOutputs,
  type ModelDescriptor,
  type RawModelOutput,
} from './modelCatalog';
import { analyzeCommentText } from '../content/analysis/sentimentAnalyzer';
import { modelStore } from '../settings/modelStore';
import { MSG } from '../shared/messages';

/**
 * On-device inference for NoH8, hosted inside the offscreen document.
 *
 * This is the only module that talks to Transformers.js. It keeps a singleton
 * pipeline per model, downloads models from the Hugging Face Hub on demand,
 * and exposes lifecycle helpers (download / delete / refresh) that the settings
 * UI drives through messaging.
 */

// Force remote model + wasm loading. `allowLocalModels = false` avoids any
// attempt to read bundled local weights that we do not ship.
env.allowRemoteModels = true;
env.allowLocalModels = false;
env.useBrowserCache = true;

// Never run onnxruntime-web through a proxy/threaded web worker.
//
// By default onnxruntime-web sets `numThreads = min(4, cores/2)`. When
// `numThreads > 1` it loads the *threaded* WASM build and spawns an Emscripten
// pthread worker. That worker boots by `importScripts()`ing its bundled main
// script, which onnxruntime-web hands over as a blob: URL. The MV3
// extension_pages CSP ("script-src 'self' 'wasm-unsafe-eval'") forbids loading
// scripts from blob: sources, so the worker dies with a NetworkError and every
// model download / inference fails inside the offscreen document.
//
// Forcing `numThreads = 1` makes onnxruntime-web pick the single-threaded WASM
// build (no pthread worker, no blob script), which runs cleanly under CSP.
// `proxy = false` additionally blocks the separate blob-backed proxy-worker
// path, so nothing is ever loaded from a blob: URL.
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;

/**
 * Download (and prime) a model. Updates the shared model status in storage so
 * the settings UI can reflect progress, streams per-file percentage progress
 * back through the store, and logs progress to the console for diagnostics.
 */
export async function downloadModel(modelId: string): Promise<void> {
  const descriptor = findModelDescriptor(modelId);
  if (!descriptor) throw new Error(`Unknown model: ${modelId}`);

  console.info(`[NoH8] Downloading model "${modelId}" (${descriptor.modelId})…`);
  modelStore.getState().setModelStatus(modelId, 'downloading');
  modelStore.getState().setDownloadProgress(modelId, 0);
  try {
    await getPipeline(descriptor, createProgressReporter(modelId));
    modelStore.getState().setDownloadProgress(modelId, 100);
    modelStore.getState().markModelDownloaded(modelId);
    modelStore.getState().setModelStatus(modelId, 'ready');
    console.info(`[NoH8] Model "${modelId}" downloaded and ready.`);
  } catch (error) {
    modelStore.getState().setModelStatus(modelId, 'error');
    console.error(`[NoH8] Failed to download model "${modelId}":`, error);
    throw error;
  }
}

/**
 * Build a Transformers.js `progress_callback` that forwards throttled whole-percent
 * download progress to the shared model store (in turns persisted to
 * `chrome.storage.local`, so the settings UI updates live) and to the console.
 * Non-progress lifecycle events (initiate / download / done) are ignored.
 */
function createProgressReporter(
  modelId: string
): (event: { status?: string; progress?: number }) => void {
  let lastPercent = -1;
  return (event) => {
    if (event.status !== 'progress' || typeof event.progress !== 'number') return;
    const percent = Math.max(0, Math.min(100, Math.round(event.progress)));
    if (percent === lastPercent) return; // throttle storage writes to per-percent
    lastPercent = percent;
    console.debug(`[NoH8] Model "${modelId}" download progress: ${percent}%`);
    modelStore.getState().setDownloadProgress(modelId, percent);
  };
}

/** Best-effort removal of the model's files from the Cache Storage API. */
async function clearModelFromCache(modelId: string): Promise<void> {
  try {
    const cacheNames = await (caches as CacheStorage).keys();
    const targeted = cacheNames.filter((name) =>
      name.toLowerCase().includes(modelId.toLowerCase())
    );
    await Promise.all(targeted.map((name) => (caches as CacheStorage).delete(name)));
  } catch {
    // Cache Storage may be unavailable; deletion of the cached files is best-effort.
  }
}

/**
 * Delete a downloaded model: dispose its in-memory pipeline, clear its cached
 * files (where supported) and update storage so the settings UI empties the slot.
 */
export async function deleteModel(modelId: string): Promise<void> {
  PIPELINES.delete(modelId);
  await clearModelFromCache(modelId);
  modelStore.getState().unmarkModelDownloaded(modelId);
  modelStore.getState().setModelStatus(modelId, 'not_downloaded');
}

/**
 * Re-download a model from scratch (dispose + clear, then download again).
 * Useful when a download was interrupted or a newer revision is desired.
 */
export async function refreshModel(modelId: string): Promise<void> {
  await deleteModel(modelId);
  await downloadModel(modelId);
}

/** Handle a request routed to the offscreen document by the service worker. */
export async function handleOffscreenRequest(
  message: {
    type: string;
    text?: string;
    commentId?: string;
    modelId?: string;
  }
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  switch (message.type) {
    case MSG.ANALYZE:
      return {
        ok: true,
        data: await analyzeComment(message.text ?? '', message.commentId ?? ''),
      };
    case MSG.DOWNLOAD:
      await downloadModel(message.modelId ?? '');
      return { ok: true, data: null };
    case MSG.DELETE:
      await deleteModel(message.modelId ?? '');
      return { ok: true, data: null };
    case MSG.REFRESH:
      await refreshModel(message.modelId ?? '');
      return { ok: true, data: null };
    default:
      return { ok: false, error: `Unsupported offscreen message: ${message.type}` };
  }
}

/** Singleton pipelines keyed by catalog model id. */
const PIPELINES = new Map<string, unknown>();

async function getPipeline(
  descriptor: ModelDescriptor,
  onProgress?: (event: { status?: string; progress?: number }) => void
): Promise<unknown> {
  const existing = PIPELINES.get(descriptor.id);
  if (existing) return existing;
  const instance = await pipeline(descriptor.task, descriptor.modelId, {
    ...(onProgress ? { progress_callback: onProgress } : {}),
  });
  PIPELINES.set(descriptor.id, instance);
  return instance;
}

function normalizeRawOutput(raw: unknown): RawModelOutput[] {
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((entry) => ({
    label: String((entry as { label?: unknown }).label ?? ''),
    score: Number((entry as { score?: unknown }).score ?? 0),
  }));
}

/**
 * Run the given text through a specific catalog model and convert the output
 * into a `CommentAnalysis`. Throws if the model cannot be loaded.
 */
export async function analyzeWithModel(
  text: string,
  modelId: string
): Promise<CommentAnalysis> {
  const descriptor = findModelDescriptor(modelId);
  if (!descriptor) throw new Error(`Unknown model: ${modelId}`);

  const instance = await getPipeline(descriptor);
  const raw = await (instance as (input: string, opts?: object) => Promise<unknown>)(
    text,
    { topk: 10 }
  );
  return commentAnalysisFromOutputs({
    modelId: descriptor.id,
    commentId: '',
    outputs: normalizeRawOutput(raw),
  });
}

/**
 * Analyze text using the model currently selected in the settings store.
 * Falls back to the built-in heuristic analyser whenever the model pipeline
 * cannot be loaded or fails, so analysis never blocks the UI.
 */
export async function analyzeComment(
  text: string,
  commentId: string
): Promise<CommentAnalysis> {
  const modelId = modelStore.getState().selectedModelId;
  try {
    const result = await analyzeWithModel(text, modelId);
    return { ...result, commentId };
  } catch (error) {
    console.warn(
      `[NoH8] model inference failed (${modelId}), using heuristic fallback:`,
      error
    );
    return analyzeCommentText({ id: commentId, text });
  }
}