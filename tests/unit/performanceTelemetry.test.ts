import { describe, it, expect, beforeEach } from 'vitest';
import { recordLatency, buildHistogram, resetHistogram, getPerformanceStats } from '../performanceTelemetry';

describe('Performance Telemetry', () => {
  beforeEach(() => {
    resetHistogram();
  });

  describe('recordLatency', () => {
    it('records a single latency value', () => {
      recordLatency(100);
      const histogram = buildHistogram();
      expect(histogram.values).toHaveLength(1);
      expect(histogram.values[0]).toBe(100);
    });

    it('accumulates multiple latency values', () => {
      recordLatency(100);
      recordLatency(200);
      recordLatency(300);
      const histogram = buildHistogram();
      expect(histogram.values).toHaveLength(3);
    });
  });

  describe('buildHistogram', () => {
    it('returns empty histogram when no values recorded', () => {
      const histogram = buildHistogram();
      expect(histogram.values).toHaveLength(0);
      expect(histogram.count).toBe(0);
    });

    it('computes min, max, and count correctly', () => {
      recordLatency(100);
      recordLatency(200);
      recordLatency(300);
      const histogram = buildHistogram();
      expect(histogram.count).toBe(3);
      expect(histogram.min).toBe(100);
      expect(histogram.max).toBe(300);
    });

    it('computes median correctly for odd number of values', () => {
      recordLatency(100);
      recordLatency(200);
      recordLatency(300);
      const histogram = buildHistogram();
      expect(histogram.median).toBe(200);
    });

    it('computes median correctly for even number of values', () => {
      recordLatency(100);
      recordLatency(200);
      recordLatency(300);
      recordLatency(400);
      const histogram = buildHistogram();
      expect(histogram.median).toBe(250);
    });

    it('computes p95 correctly', () => {
      for (let i = 0; i < 100; i++) {
        recordLatency(i * 10);
      }
      const histogram = buildHistogram();
      expect(histogram.p95).toBe(950);
    });
  });

  describe('resetHistogram', () => {
    it('clears all recorded values', () => {
      recordLatency(100);
      recordLatency(200);
      resetHistogram();
      const histogram = buildHistogram();
      expect(histogram.values).toHaveLength(0);
      expect(histogram.count).toBe(0);
    });
  });

  describe('getPerformanceStats', () => {
    it('returns default stats when no data recorded', () => {
      const stats = getPerformanceStats();
      expect(stats.totalInferences).toBe(0);
      expect(stats.medianLatencyMs).toBe(0);
      expect(stats.p95LatencyMs).toBe(0);
      expect(stats.minLatencyMs).toBe(0);
      expect(stats.maxLatencyMs).toBe(0);
    });

    it('returns computed stats after recording latencies', () => {
      recordLatency(100);
      recordLatency(200);
      recordLatency(300);
      const stats = getPerformanceStats();
      expect(stats.totalInferences).toBe(3);
      expect(stats.medianLatencyMs).toBe(200);
      expect(stats.p95LatencyMs).toBe(300);
      expect(stats.minLatencyMs).toBe(100);
      expect(stats.maxLatencyMs).toBe(300);
    });
  });
});
