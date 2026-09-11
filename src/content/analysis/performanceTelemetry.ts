/**
 * Performance Telemetry Module
 *
 * Records per-comment inference latency and queue-wait times in memory,
 * persists a rolling histogram to chrome.storage.local (local-only, never synced).
 * Provides statistical summaries (median, p95, min, max) for the settings UI.
 *
 * Privacy: All data stays on-device in chrome.storage.local. Never uses
 * chrome.storage.sync. Never sends data over the network.
 */

interface LatencyRecord {
  value: number;
  timestamp: number;
}

interface Histogram {
  values: number[];
  count: number;
  min: number;
  max: number;
  median: number;
  p95: number;
}

interface PerformanceStats {
  totalInferences: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  cacheHitRate: number;
  lastResetAt: number;
}

// In-memory storage for latency records (rolling window)
const MAX_RECORDED_VALUES = 1000;
const latencyRecords: LatencyRecord[] = [];

// Persistence key for chrome.storage.local
const STORAGE_KEY = 'noh8:performance:histogram';

/**
 * Records a single inference latency value in milliseconds.
 * Values are stored in memory and capped at MAX_RECORDED_VALUES.
 */
export function recordLatency(latencyMs: number): void {
  if (latencyMs < 0) {
    console.warn('[PerformanceTelemetry] Negative latency value ignored:', latencyMs);
    return;
  }

  latencyRecords.push({
    value: latencyMs,
    timestamp: Date.now()
  });

  // Maintain rolling window by removing oldest entries if needed
  if (latencyRecords.length > MAX_RECORDED_VALUES) {
    latencyRecords.shift();
  }
}

/**
 * Builds a histogram from the recorded latency values.
 * Returns statistical summary including count, min, max, median, and p95.
 */
export function buildHistogram(): Histogram {
  const values = latencyRecords.map(r => r.value);

  if (values.length === 0) {
    return {
      values: [],
      count: 0,
      min: 0,
      max: 0,
      median: 0,
      p95: 0
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];

  // Calculate median
  let median: number;
  if (count % 2 === 0) {
    median = (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
  } else {
    median = sorted[Math.floor(count / 2)];
  }

  // Calculate p95 (95th percentile)
  const p95Index = Math.ceil(count * 0.95) - 1;
  const p95 = sorted[Math.max(0, p95Index)];

  return {
    values,
    count,
    min,
    max,
    median,
    p95
  };
}

/**
 * Resets the histogram by clearing all recorded latency values.
 * Also clears the persisted data in chrome.storage.local.
 */
export function resetHistogram(): void {
  latencyRecords.length = 0;

  // Clear persisted data if chrome.storage.local is available
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.remove(STORAGE_KEY).catch(err => {
      console.warn('[PerformanceTelemetry] Failed to clear storage:', err);
    });
  }
}

/**
 * Gets comprehensive performance statistics for display in settings UI.
 * Includes total inferences, latency statistics, and cache hit rate.
 */
export function getPerformanceStats(): PerformanceStats {
  const histogram = buildHistogram();

  return {
    totalInferences: histogram.count,
    medianLatencyMs: histogram.median,
    p95LatencyMs: histogram.p95,
    minLatencyMs: histogram.min,
    maxLatencyMs: histogram.max,
    cacheHitRate: 0, // Will be updated when cache tracking is added
    lastResetAt: Date.now()
  };
}

/**
 * Persists the current histogram to chrome.storage.local.
 * This is called periodically to ensure data survives page reloads.
 */
export async function persistHistogram(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  const histogram = buildHistogram();
  const dataToPersist = {
    values: histogram.values,
    count: histogram.count,
    min: histogram.min,
    max: histogram.max,
    median: histogram.median,
    p95: histogram.p95,
    lastUpdated: Date.now()
  };

  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: dataToPersist });
  } catch (err) {
    console.warn('[PerformanceTelemetry] Failed to persist histogram:', err);
  }
}

/**
 * Loads persisted histogram data from chrome.storage.local.
 * Restores the histogram after page reloads.
 */
export async function loadPersistedHistogram(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const persisted = result[STORAGE_KEY] as {
      values: number[];
      count: number;
      min: number;
      max: number;
      median: number;
      p95: number;
      lastUpdated: number;
    } | undefined;

    if (persisted && Array.isArray(persisted.values)) {
      // Restore the values, respecting the max window size
      const restoreCount = Math.min(persisted.values.length, MAX_RECORDED_VALUES);
      latencyRecords.length = 0;

      for (let i = 0; i < restoreCount; i++) {
        latencyRecords.push({
          value: persisted.values[i],
          timestamp: Date.now() - (restoreCount - i) * 1000 // Approximate timestamps
        });
      }
    }
  } catch (err) {
    console.warn('[PerformanceTelemetry] Failed to load persisted histogram:', err);
  }
}
