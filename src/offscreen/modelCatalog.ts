import type { CommentAnalysis, Sentiment, SentimentLabel } from '../shared/types';

/**
 * Curated catalog of on-device text-classification models suitable for
 * hate-speech / toxicity and sentiment detection. Each entry describes how to
 * interpret the model's raw `{ label, score }[]` output so it can be mapped
 * onto the extension's `CommentAnalysis` shape.
 *
 * Models are loaded via Transformers.js from the Hugging Face Hub and run
 * entirely locally (WebAssembly/WebGPU) inside the offscreen document.
 */

export type ModelMode = 'toxicity' | 'polarity' | 'star-rating';

export interface ModelDescriptor {
  /** Stable, unique id used across storage + messaging. */
  id: string;
  /** Human friendly name for the settings UI. */
  name: string;
  /** Short description shown in the settings UI. */
  description: string;
  /** Transformers.js task type. Always `text-classification` here. */
  task: 'text-classification';
  /** Hugging Face model id passed to `pipeline()` (e.g. `Xenova/toxic-bert`). */
  modelId: string;
  /**
   * How the model's output should be interpreted:
   *  - `toxicity`: labels map 1:1 to the presence of harmful/abusive content.
   *  - `polarity`: labels describe positive/negative sentiment.
   *  - `star-rating`: labels are ordinal star counts (e.g. "1 star" … "5 stars").
   *    A confidence-weighted average of the ordinal positions maps to [-1, 1].
   */
  mode: ModelMode;
  /** Model output labels treated as hateful/abusive (toxicity models). */
  hateLabels: string[];
  /** Model output label associated with positive sentiment (polarity models). */
  positiveLabel?: string;
  /** Model output label associated with negative sentiment (polarity models). */
  negativeLabel?: string;
  /**
   * Ordered list of star-rating labels from worst to best, e.g.
   * `["1 star", "2 stars", "3 stars", "4 stars", "5 stars"]`.
   * Required when `mode === "star-rating"`.
   */
  starLabels?: string[];
  /**
   * Approximate download size in bytes of the quantized ONNX weight file
   * actually fetched by Transformers.js (`onnx/model_quantized.onnx` via
   * `Content-Length`). Shown per model in the settings UI so users know the
   * one-time download cost before clicking Download. Measured 2026-09-15;
   * tokenizer/config files (<2 MB) are excluded.
   */
  sizeBytes: number;
}

/**
 * Render a byte count as a human-readable size (B / KB / MB / GB), e.g.
 * `formatBytes(110720344)` → `"105.6 MB"`. Pure helper for the settings UI.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? Math.round(value).toString() : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

export const MODEL_CATALOG: ModelDescriptor[] = [
  {
    id: 'toxic-bert',
    name: 'Toxic-BERT',
    description:
      'BERT (multilingual) tuned to detect six kinds of toxicity, including identity hate. Best all-round hate-speech detector.',
    task: 'text-classification',
    modelId: 'Xenova/toxic-bert',
    mode: 'toxicity',
    hateLabels: [
      'toxic',
      'severe_toxic',
      'obscene',
      'threat',
      'insult',
      'identity_hate',
    ],
    sizeBytes: 110720344,
  },
  {
    id: 'bert-multilingual',
    name: 'DistilBERT Multilingual Sentiment',
    description:
      'Lightweight multilingual model analysing positive/negative sentiment across many languages.',
    task: 'text-classification',
    modelId: 'Xenova/bert-base-multilingual-uncased-sentiment',
    // This model (nlptown/bert-base-multilingual-uncased-sentiment) outputs
    // 1–5 star rating labels, NOT binary positive/negative. We map the ordinal
    // positions to [-1, +1] using a confidence-weighted average.
    mode: 'star-rating',
    hateLabels: [],
    starLabels: ['1 star', '2 stars', '3 stars', '4 stars', '5 stars'],
    sizeBytes: 168593695,
  },
  {
    id: 'sst-2-english',
    name: 'DistilBERT SST-2 Sentiment',
    description:
      'Small, fast English sentiment model (Stanford SST-2). Good when speed matters most.',
    task: 'text-classification',
    modelId: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    mode: 'polarity',
    hateLabels: [],
    positiveLabel: 'positive',
    negativeLabel: 'negative',
    sizeBytes: 67581197,
  },
  {
    id: 'twitter-roberta',
    name: 'Twitter RoBERTa Sentiment',
    description:
      'RoBERTa fine-tuned on recent Twitter posts for positive/neutral/negative sentiment.',
    task: 'text-classification',
    modelId: 'Xenova/twitter-roberta-base-sentiment-latest',
    mode: 'polarity',
    hateLabels: [],
    positiveLabel: 'positive',
    negativeLabel: 'negative',
    sizeBytes: 125905426,
  },
];
/** The model selected out of the box. Fast, multilingual and hate-oriented. */
export const DEFAULT_MODEL_ID = 'toxic-bert';

/** Raw `{ label, score }` entry produced by a text-classification pipeline. */
export interface RawModelOutput {
  label: string;
  score: number;
}

/** Confidence at or above which a toxicity output flags a comment as hate. */
export const HATE_SPEECH_THRESHOLD = 0.5;
/** Negativity above which polarity models are treated as nearly-certain hate. */
const POLARITY_HATE_THRESHOLD = 0.9;

const POSITIVE_LABEL_THRESHOLD = 0.25;
const NEGATIVE_LABEL_THRESHOLD = -0.25;

export function findModelDescriptor(id: string | undefined): ModelDescriptor | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Highest score among outputs whose lower-cased label appears in `labels`. */
function bestScore(outputs: RawModelOutput[], labels: string[]): number {
  if (labels.length === 0) return 0;
  const set = new Set(labels.map((l) => l.toLowerCase()));
  return clamp(
    outputs.reduce(
      (best, out) =>
        set.has(out.label.toLowerCase()) ? Math.max(best, out.score) : best,
      0
    ),
    0,
    1
  );
}

/** Sentiment label derived from a continuous [-1, 1] sentiment score. */
function sentimentLabelFor(score: number): SentimentLabel {
  if (score > POSITIVE_LABEL_THRESHOLD) return 'positive';
  if (score < NEGATIVE_LABEL_THRESHOLD) return 'negative';
  return 'neutral';
}

/**
 * Compute a [-1, +1] sentiment score from star-rating model outputs.
 *
 * Each label in `orderedLabels` is mapped to a linearly spaced ordinal position
 * in [-1, +1]. The final score is the confidence-weighted average of all label
 * positions, so the model's full probability distribution is used rather than
 * just the argmax.
 *
 * Example for a 5-star model:
 *   "1 star" → -1.0, "2 stars" → -0.5, "3 stars" → 0.0,
 *   "4 stars" → +0.5, "5 stars" → +1.0
 */
function starRatingScore(outputs: RawModelOutput[], orderedLabels: string[]): number {
  const n = orderedLabels.length;
  if (n === 0) return 0;
  const labelToPosition = new Map<string, number>(
    orderedLabels.map((label, i) => [label.toLowerCase(), n === 1 ? 0 : -1 + (2 * i) / (n - 1)])
  );
  let weightedSum = 0;
  let totalWeight = 0;
  for (const out of outputs) {
    const position = labelToPosition.get(out.label.toLowerCase());
    if (position !== undefined) {
      weightedSum += position * out.score;
      totalWeight += out.score;
    }
  }
  return totalWeight === 0 ? 0 : clamp(weightedSum / totalWeight, -1, 1);
}

/**
 * Convert a model's raw output into the extension's `CommentAnalysis` payload.
 * Model-agnostic: the descriptor decides how labels map to sentiment/hate.
 */
export function commentAnalysisFromOutputs(options: {
  modelId: string;
  commentId: string;
  outputs: RawModelOutput[];
}): CommentAnalysis {
  const { modelId, commentId, outputs } = options;
  const descriptor = findModelDescriptor(modelId);

  // Unknown model -> deterministically neutral, nothing flagged.
  if (!descriptor) {
    const sentiment: Sentiment = { score: 0, label: 'neutral' };
    return { commentId, sentiment, isHateSpeech: false, hateSpeechScore: 0, issues: [] };
  }

  let hateSpeechScore: number;
  let sentimentScore: number;

  if (descriptor.mode === 'toxicity') {
    hateSpeechScore = bestScore(outputs, descriptor.hateLabels);
    // Low-to-no toxicity maps to positive sentiment, high toxicity to negative.
    sentimentScore = 1 - 2 * hateSpeechScore;
  } else if (descriptor.mode === 'star-rating') {
    sentimentScore = starRatingScore(outputs, descriptor.starLabels ?? []);
    // Treat very-low star ratings (score ≤ -0.6, roughly 1–2 stars) as near-hate.
    hateSpeechScore = sentimentScore <= -0.6 ? Math.abs(sentimentScore) : 0;
  } else {
    const positive = bestScore(outputs, [descriptor.positiveLabel ?? '']);
    const negative = bestScore(outputs, [descriptor.negativeLabel ?? '']);
    hateSpeechScore = negative >= POLARITY_HATE_THRESHOLD ? negative : 0;
    sentimentScore = clamp(positive - negative, -1, 1);
  }

  const isHateSpeech = hateSpeechScore >= HATE_SPEECH_THRESHOLD;
  const sentiment: Sentiment = {
    score: sentimentScore,
    label: sentimentLabelFor(sentimentScore),
  };

  const issues: CommentAnalysis['issues'] = [];
  if (isHateSpeech) {
    issues.push({
      id: 'hate_speech',
      label: 'Hate speech',
      description:
        'Language targeting people based on identity (race, religion, gender, sexuality, disability).',
    });
  } else if (sentiment.label === 'negative') {
    issues.push({
      id: 'negative_tone',
      label: 'Negative tone',
      description:
        'A notably negative sentiment, though not necessarily hateful or abusive.',
    });
  }

  return {
    commentId,
    sentiment,
    isHateSpeech,
    hateSpeechScore,
    issues,
  };
}