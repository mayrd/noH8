import type { CommentAnalysis } from '../shared/types';
import {
  findModelDescriptor,
  commentAnalysisFromOutputs,
  type ModelDescriptor,
  type RawModelOutput,
} from './modelCatalog';
import { analyzeCommentText } from '../content/analysis/sentimentAnalyzer';
import {
  truncateParentContext,
  mergeCommentAnalyses,
} from '../content/analysis/threadContext';
import { modelStore } from '../settings/modelStore';
import { MSG } from '../shared/messages';
import { recordInferenceHealth } from '../shared/inferenceHealth';
import { loadTransformers } from './transformersLoader';
import { calibrateAnalysis } from './calibration';

/**
 * On-device inference for NoH8, hosted inside the offscreen document.
 *
 * This is the only module that talks to Transformers.js — and it does so
 * exclusively through `transformersLoader.ts`, which imports the library
 * lazily (keeping the heavy onnxruntime bundle out of the entry chunk) and
 * applies the MV3-CSP `env` configuration (remote models on, single-threaded
 * non-proxied wasm). It keeps a singleton pipeline per model, downloads models
 * from the Hugging Face Hub on demand, and exposes lifecycle helpers
 * (download / delete / refresh) that the settings UI drives through messaging.
 */

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
    parentText?: string;
    modelId?: string;
  }
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  switch (message.type) {
    case MSG.ANALYZE:
      return {
        ok: true,
        data: await analyzeComment(
          message.text ?? '',
          message.commentId ?? '',
          message.parentText
        ),
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

/**
 * A TextClassifier is the callable returned by Transformers.js's
 * `pipeline('text-classification', ...)`. It classifies a single text string
 * and returns the model's raw output (shape normalized downstream by
 * `normalizeRawOutput`).
 */
type TextClassifier = (input: string, opts?: { topk?: number }) => Promise<unknown>;

/** Singleton pipelines keyed by catalog model id. */
const PIPELINES = new Map<string, TextClassifier>();

async function getPipeline(
  descriptor: ModelDescriptor,
  onProgress?: (event: { status?: string; progress?: number }) => void
): Promise<TextClassifier> {
  const existing = PIPELINES.get(descriptor.id);
  if (existing) return existing;
  // Lazy import: pulls the Transformers.js chunk in on first pipeline use.
  const { pipeline } = await loadTransformers();
  const instance = (await pipeline(descriptor.task, descriptor.modelId, {
    ...(onProgress ? { progress_callback: onProgress } : {}),
  })) as TextClassifier;
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
  const raw = await instance(text, { topk: 10 });
  return commentAnalysisFromOutputs({
    modelId: descriptor.id,
    commentId: '',
    outputs: normalizeRawOutput(raw),
  });
}

/**
 * Analyze text using the model currently selected in the settings store.
 *
 * M14 (thread context): when a reply's `parentText` is supplied, the model
 * runs twice — once on the reply alone and once on the truncated parent
 * prepended to the reply — and the two analyses are merged conservatively
 * (flag if either crosses the threshold). Falls back to the built-in heuristic
 * analyser (which applies the same context semantics) whenever the model
 * pipeline cannot be loaded or fails, so analysis never blocks the UI.
 */
export async function analyzeComment(
  text: string,
  commentId: string,
  parentText?: string
): Promise<CommentAnalysis> {
  const modelId = modelStore.getState().selectedModelId;
  try {
    const replyAlone = await analyzeWithModel(text, modelId);
    let merged = replyAlone;
    if (parentText) {
      const contextText = truncateParentContext(parentText) + ' ' + text;
      const replyWithContext = await analyzeWithModel(contextText, modelId);
      merged = mergeCommentAnalyses(replyAlone, replyWithContext);
    }
    // M13: apply the locally-learned calibration at result-ingestion time —
    // a raw score below the calibrated threshold is downgraded to
    // not_flagged (the raw score stays available for the modal).
    const calibrated = await calibrateAnalysis({ ...merged, commentId }, modelId);
    // (M16) Record a healthy inference so the sidepanel can clear its
    // heuristic-fallback badge.
    recordInferenceHealth({ fallbackActive: false, modelId, updatedAt: Date.now() });
    return { ...merged, ...calibrated, commentId };
  } catch (error) {
    console.warn(
      `[NoH8] model inference failed (${modelId}), using heuristic fallback:`,
      error
    );
    // (M16) Record the fallback so the sidepanel badge makes the accuracy
    // drop visible instead of silent.
    recordInferenceHealth({ fallbackActive: true, modelId, updatedAt: Date.now() });
    return analyzeCommentText({ id: commentId, text, parentText });
  }
}