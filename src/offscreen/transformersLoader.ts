/**
 * Lazy loader for `@xenova/transformers` inside the offscreen document.
 *
 * Why lazy? Transformers.js + onnxruntime-web weigh ~800 kB minified. A static
 * import in `inference.ts` pulled that whole bundle into the offscreen entry
 * chunk (Vite's >500 kB chunk warning). Importing it dynamically through this
 * module lets Rollup split it into its own chunk that is only fetched when the
 * first model download / inference actually needs it.
 *
 * This is also the single place where the Transformers.js `env` is configured
 * for the MV3 extension CSP:
 *
 * - Remote model + wasm loading is forced on (`allowLocalModels = false`
 *   avoids any attempt to read bundled local weights that we do not ship).
 * - `numThreads = 1` makes onnxruntime-web pick the single-threaded WASM build.
 *   By default it sets `numThreads = min(4, cores/2)`; with threads enabled it
 *   spawns an Emscripten pthread worker that `importScripts()`es its bundled
 *   main script from a blob: URL. The MV3 extension_pages CSP
 *   ("script-src 'self' 'wasm-unsafe-eval'") forbids loading scripts from
 *   blob: sources, so the worker dies with a NetworkError and every model
 *   download / inference fails. `proxy = false` additionally blocks the
 *   separate blob-backed proxy-worker path, so nothing is ever loaded from a
 *   blob: URL.
 */

/** The shape of the `@xenova/transformers` module we consume. */
export type TransformersModule = typeof import('@xenova/transformers');

/** Default importer — the real dynamic import, overridable in tests. */
type TransformersImporter = () => Promise<TransformersModule>;

const defaultImporter: TransformersImporter = () => import('@xenova/transformers');

/** Memoized module promise; `null` until the first `loadTransformers()` call. */
let modulePromise: Promise<TransformersModule> | null = null;

/**
 * Apply the MV3-CSP env configuration. Idempotent; called once per successful
 * module load, before the module is handed to any caller.
 */
function configureEnv(mod: TransformersModule): void {
  mod.env.allowRemoteModels = true;
  mod.env.allowLocalModels = false;
  mod.env.useBrowserCache = true;
  mod.env.backends.onnx.wasm.numThreads = 1;
  mod.env.backends.onnx.wasm.proxy = false;
}

/**
 * Load (and memoize) the Transformers.js module. Concurrent and repeated calls
 * share a single dynamic import. A failed import is not cached — the next call
 * retries, so a transient failure does not brick inference for the session.
 */
export async function loadTransformers(
  importer: TransformersImporter = defaultImporter
): Promise<TransformersModule> {
  if (!modulePromise) {
    modulePromise = importer().then((mod) => {
      configureEnv(mod);
      return mod;
    });
    // Do not memoize rejections: drop the cached promise on failure so the
    // next call retries the dynamic import.
    modulePromise.catch(() => {
      modulePromise = null;
    });
  }
  return modulePromise;
}

/**
 * Test-only reset of the memoized import. Production code must never call this.
 */
export function resetLoaderForTests(): void {
  modulePromise = null;
}
