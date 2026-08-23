import { describe, test, expect } from 'vitest';
import {
  MODEL_CATALOG,
  DEFAULT_MODEL_ID,
  findModelDescriptor,
  commentAnalysisFromOutputs,
  HATE_SPEECH_THRESHOLD,
} from '../../src/offscreen/modelCatalog';

describe('ModelCatalog', () => {
  test('exposes the default model id and it exists in the catalog', () => {
    expect(DEFAULT_MODEL_ID).toBe('toxic-bert');
    expect(MODEL_CATALOG.some((m) => m.id === DEFAULT_MODEL_ID)).toBe(true);
  });

  test('contains at least one clearly hate-speech-oriented model', () => {
    const hasToxicityModel = MODEL_CATALOG.some(
      (m) => m.mode === 'toxicity' && m.hateLabels.length > 0
    );
    expect(hasToxicityModel).toBe(true);
  });

  test('every catalog entry has the fields the UI and pipeline rely on', () => {
    for (const model of MODEL_CATALOG) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.description).toBeTruthy();
      expect(model.task).toBe('text-classification');
      expect(model.modelId).toMatch(/^[A-Za-z0-9._/-]+$/);
      expect(['toxicity', 'polarity', 'star-rating']).toContain(model.mode);
    }
    // ids are unique
    const ids = MODEL_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('looks up descriptors by id', () => {
    expect(findModelDescriptor(DEFAULT_MODEL_ID)?.mode).toBe('toxicity');
    expect(findModelDescriptor('does-not-exist')).toBeUndefined();
  });

  test('bert-multilingual uses star-rating mode with correct labels', () => {
    const desc = findModelDescriptor('bert-multilingual')!;
    expect(desc.mode).toBe('star-rating');
    expect(desc.starLabels).toEqual(['1 star', '2 stars', '3 stars', '4 stars', '5 stars']);
  });
});

describe('commentAnalysisFromOutputs', () => {
  const catalogEntry = (id: string) => findModelDescriptor(id)!;

  test('flags heavy toxic-bert output as hate speech with negative sentiment', () => {
    const outputs = [
      { label: 'toxic', score: 0.91 },
      { label: 'severe_toxic', score: 0.1 },
      { label: 'identity_hate', score: 0.94 },
      { label: 'obscene', score: 0.2 },
    ];
    const result = commentAnalysisFromOutputs({
      modelId: DEFAULT_MODEL_ID,
      commentId: 'c1',
      outputs,
    });
    expect(result.commentId).toBe('c1');
    expect(result.isHateSpeech).toBe(true);
    expect(result.hateSpeechScore).toBeGreaterThanOrEqual(HATE_SPEECH_THRESHOLD);
    expect(result.sentiment.score).toBeLessThan(0);
    expect(result.sentiment.label).toBe('negative');
    expect(result.issues.map((i) => i.id)).toContain('hate_speech');
  });

  test('does not flag benign toxic-bert output', () => {
    const outputs = [
      { label: 'toxic', score: 0.01 },
      { label: 'identity_hate', score: 0.0 },
    ];
    const result = commentAnalysisFromOutputs({
      modelId: DEFAULT_MODEL_ID,
      commentId: 'c2',
      outputs,
    });
    expect(result.isHateSpeech).toBe(false);
    expect(result.sentiment.score).toBeGreaterThan(0);
    expect(result.sentiment.label).toBe('positive');
    expect(result.issues).toHaveLength(0);
  });

  test('treats a polarity model (sst-2) positive output as positive', () => {
    const desc = catalogEntry('sst-2-english');
    const outputs = [
      { label: 'POSITIVE', score: 0.95 },
      { label: 'NEGATIVE', score: 0.05 },
    ];
    const result = commentAnalysisFromOutputs({
      modelId: desc.id,
      commentId: 'c3',
      outputs,
    });
    expect(result.sentiment.label).toBe('positive');
    expect(result.isHateSpeech).toBe(false);
  });

  test('adds a negative_tone issue for negative non-hate polarity output', () => {
    const desc = catalogEntry('sst-2-english');
    const outputs = [
      { label: 'POSITIVE', score: 0.3 },
      { label: 'NEGATIVE', score: 0.7 },
    ];
    const result = commentAnalysisFromOutputs({
      modelId: desc.id,
      commentId: 'c4',
      outputs,
    });
    expect(result.sentiment.label).toBe('negative');
    expect(result.isHateSpeech).toBe(false);
    expect(result.issues.map((i) => i.id)).toContain('negative_tone');
  });

  test('star-rating model maps 1-star confident output to strongly negative sentiment', () => {
    // "Peinlich und lächerlich" → model strongly predicts 1 star
    const outputs = [
      { label: '1 star', score: 0.85 },
      { label: '2 stars', score: 0.10 },
      { label: '3 stars', score: 0.03 },
      { label: '4 stars', score: 0.01 },
      { label: '5 stars', score: 0.01 },
    ];
    const result = commentAnalysisFromOutputs({
      modelId: 'bert-multilingual',
      commentId: 'c5',
      outputs,
    });
    expect(result.sentiment.score).toBeLessThan(-0.5);
    expect(result.sentiment.label).toBe('negative');
  });

  test('star-rating model maps 5-star confident output to positive sentiment', () => {
    const outputs = [
      { label: '1 star', score: 0.01 },
      { label: '2 stars', score: 0.01 },
      { label: '3 stars', score: 0.03 },
      { label: '4 stars', score: 0.10 },
      { label: '5 stars', score: 0.85 },
    ];
    const result = commentAnalysisFromOutputs({
      modelId: 'bert-multilingual',
      commentId: 'c6',
      outputs,
    });
    expect(result.sentiment.score).toBeGreaterThan(0.5);
    expect(result.sentiment.label).toBe('positive');
  });

  test('star-rating model maps 3-star output to neutral sentiment', () => {
    const outputs = [
      { label: '1 star', score: 0.1 },
      { label: '2 stars', score: 0.1 },
      { label: '3 stars', score: 0.6 },
      { label: '4 stars', score: 0.1 },
      { label: '5 stars', score: 0.1 },
    ];
    const result = commentAnalysisFromOutputs({
      modelId: 'bert-multilingual',
      commentId: 'c7',
      outputs,
    });
    expect(result.sentiment.score).toBeGreaterThan(-0.25);
    expect(result.sentiment.score).toBeLessThan(0.25);
    expect(result.sentiment.label).toBe('neutral');
  });
});