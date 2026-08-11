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

export type ModelMode = 'toxicity' | 'polarity';

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
   */
  mode: ModelMode;
  /** Model output labels treated as hateful/abusive (toxicity models). */
  hateLabels: string[];
  /** Model output label associated with positive sentiment (polarity models). */
  positiveLabel?: string;
  /** Model output label associated with negative sentiment (polarity models). */
  negativeLabel?: string;
/** Approximate download size in megabytes. */\n   sizeMb: number;\n   /** Estimated VRAM consumption in megabytes. */\n   vramMb: number;\n
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
  },
  {
    id: 'bert-multilingual',
    name: 'DistilBERT Multilingual Sentiment',
    description:
      'Lightweight multilingual model analysing positive/negative sentiment across many languages.',
    task: 'text-classification',
    modelId: 'Xenova/bert-base-multilingual-uncased-sentiment',
    mode: 'polarity',
    hateLabels: [],
    positiveLabel: 'positive',
    negativeLabel: 'negative',
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
  },
  {
    id: 'twitter-roberta',
    name: 'Twitter RoBERTa Sentiment',
    description:
      'RoBERTa fine-tuned on recent Twitter posts for positive/neutral/negative sentiment.',
    task: 'text-classification',
    modelId: 'Xenova/cardiffnlp/twitter-roberta-base-sentiment-latest',
    mode: 'polarity',
    hateLabels: [],
    positiveLabel: 'positive',
    negativeLabel: 'negative',
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