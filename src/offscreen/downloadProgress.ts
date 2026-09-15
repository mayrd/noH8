import { modelStore } from '../settings/modelStore';

/**
 * Transformers.js `progress_callback` event (per-file loaded/total bytes).
 *
 * Transformers.js streams one `progress` event sequence per file (weights,
 * tokenizer, config), each carrying its own `loaded`/`total` byte counts
 * alongside the legacy `progress` percent. Lifecycle events (`initiate` /
 * `download` / `done`) carry `status` + `file` only.
 */
export interface TransformersProgressEvent {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

/**
 * Build a Transformers.js `progress_callback` that aggregates per-file
 * `loaded`/`total` bytes into a single model-level detail record. The byte
 * totals are forwarded to the shared model store (in turn persisted to
 * `chrome.storage.local`, so the settings UI can render progress on the file
 * size live) and to the console. Non-progress lifecycle events (initiate /
 * download / done) update the current file name only. Percent-only events
 * (no byte counts) fall back to the legacy percent path.
 */
export function createProgressReporter(
  modelId: string,
  catalogSizeBytes = 0
): (event: TransformersProgressEvent) => void {
  // Per-file byte state for this download: Transformers.js emits one
  // `progress` stream per file, each with its own loaded/total. Summing them
  // gives the model-level "x of y MB".
  const files = new Map<string, { loaded: number; total: number }>();
  let lastPercent = -1;
  let currentFile: string | undefined;
  return (event) => {
    if (event.status !== 'progress') {
      if (typeof event.file === 'string') currentFile = event.file;
      return;
    }
    const file = event.file ?? 'onnx/model_quantized.onnx';
    currentFile = file;
    const loaded = typeof event.loaded === 'number' ? event.loaded : undefined;
    const total = typeof event.total === 'number' ? event.total : undefined;
    // Fall back to the legacy percent-only shape when byte counts are absent.
    if (loaded === undefined || total === undefined || total <= 0) {
      if (typeof event.progress !== 'number') return;
      const percent = Math.max(0, Math.min(100, Math.round(event.progress)));
      if (percent === lastPercent) return; // throttle storage writes to per-percent
      lastPercent = percent;
      console.debug(`[NoH8] Model "${modelId}" download progress: ${percent}%`);
      modelStore.getState().setDownloadProgress(modelId, percent);
      return;
    }
    files.set(file, { loaded: Math.max(0, loaded), total: Math.max(0, total) });
    let loadedBytes = 0;
    let totalBytes = 0;
    for (const entry of files.values()) {
      loadedBytes += entry.loaded;
      totalBytes += entry.total;
    }
    // Include the catalog's known weight size when the stream's total is
    // smaller (e.g. only tokenizer files reported so far).
    if (catalogSizeBytes > totalBytes) totalBytes = catalogSizeBytes;
    if (loadedBytes > totalBytes) totalBytes = loadedBytes;
    const percent =
      totalBytes > 0 ? Math.max(0, Math.min(100, Math.round((loadedBytes / totalBytes) * 100))) : 0;
    if (percent === lastPercent) return; // throttle storage writes to per-percent
    lastPercent = percent;
    console.debug(
      `[NoH8] Model "${modelId}" download progress: ${percent}% (${loadedBytes}/${totalBytes} bytes)`
    );
    modelStore.getState().setDownloadDetail(modelId, {
      loadedBytes,
      totalBytes,
      percent,
      file: currentFile,
    });
  };
}
