import { describe, test, expect } from 'vitest';
import {
  classifyModelFailure,
  MODEL_FAILURE_KINDS,
  type ModelFailureKind,
} from '../../src/settings/modelFailure';

describe('classifyModelFailure', () => {
  test('exposes the documented failure kinds', () => {
    expect([...MODEL_FAILURE_KINDS].sort()).toEqual(['corrupt', 'network', 'quota', 'unknown']);
  });

  test('classifies network-level errors', () => {
    expect(classifyModelFailure(new Error('fetch failed'))).toBe('network');
    expect(classifyModelFailure(new Error('network timeout while downloading'))).toBe('network');
    expect(classifyModelFailure(new Error('Failed to fetch https://huggingface.co/...'))).toBe(
      'network'
    );
    expect(classifyModelFailure(new Error('ERR_INTERNET_DISCONNECTED'))).toBe('network');
    expect(classifyModelFailure(new Error('request timed out after 30000ms'))).toBe('network');
  });

  test('classifies corrupted-archive errors', () => {
    expect(classifyModelFailure(new Error('invalid archive or corrupt onnx file'))).toBe('corrupt');
    expect(classifyModelFailure(new Error('checksum mismatch for model.onnx'))).toBe('corrupt');
    expect(classifyModelFailure(new Error('unexpected end of data'))).toBe('corrupt');
  });

  test('classifies quota errors', () => {
    expect(classifyModelFailure(new Error('quota exceeded in cache storage'))).toBe('quota');
    expect(classifyModelFailure(new Error('storage full'))).toBe('quota');
  });

  test('returns unknown for unrecognized errors', () => {
    expect(classifyModelFailure(new Error('something exploded'))).toBe('unknown');
    expect(classifyModelFailure(undefined)).toBe('unknown');
    expect(classifyModelFailure('plain string failure')).toBe('unknown');
    expect(classifyModelFailure(null)).toBe('unknown');
  });

  test('classification is case-insensitive and message-derived only', () => {
    expect(classifyModelFailure(new Error('NETWORK ERROR'))).toBe('network');
    expect(classifyModelFailure(new Error('QuotaExceededError'))).toBe('quota');
  });
});
