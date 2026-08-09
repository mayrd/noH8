import type {
  CommentAnalysis,
  CommentData,
  DetectedIssue,
  IssueId,
  Sentiment,
  SentimentLabel,
} from '../../shared/types';

/**
 * Privacy-first, on-device comment analysis.
 *
 * In place of (or as a deterministic fallback for) a large bundled ML model,
 * this heuristic analyzer scores a comment's sentiment and flags likely hate
 * speech / other issues entirely from word frequency counts. It requires no
 * network access and no model download, so analysis always works instantly,
 * offline and without any text leaving the browser.
 */

/** Curated positive-affect words used to nudge the sentiment score up. */
const POSITIVE_WORDS = new Set([
  'love', 'good', 'great', 'amazing', 'awesome', 'nice', 'happy', 'thank',
  'thanks', 'best', 'fantastic', 'beautiful', 'respect', 'enjoy', 'support',
  'like', 'cool', 'wonderful', 'brilliant', 'excellent',
]);

/** Curated negative-affect words used to nudge the sentiment score down. */
const NEGATIVE_WORDS = new Set([
  'hate', 'awful', 'terrible', 'worst', 'sad', 'bad', 'angry',
  'disappointed', 'horrible', 'annoy', 'stupid', 'boring', 'dislike',
  'miserable', 'unpleasant', 'waste',
]);

/** Clearly hateful / slurs → hate speech. */
const HATE_WORDS = new Set([
  'nazi', 'nazis', 'racist', 'racists', 'homophobe', 'homophobes',
  'exterminate', 'exterminated', 'degenerate', 'degenerates', 'hitler',
]);

/** Abusive/harassing personal attacks → harassment. */
const HARASSMENT_WORDS = new Set([
  'idiot', 'idiotic', 'worthless', 'pathetic', 'loser', 'suck',
  'shut up', 'scum',
]);

/** Mild vulgarity → profanity. */
const PROFANITY_WORDS = new Set([
  'damn', 'hell', 'shit', 'crap', 'bloody',
]);

/** Tokenize lower-cased alphabetic words, preserving apostrophes (e.g. "don't"). */
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

function containsAny(tokens: string[], set: Set<string>): number {
  let count = 0;
  for (const token of tokens) {
    if (set.has(token)) count += 1;
  }
  return count;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Derive a coarse label from a continuous [-1, 1] score. */
function labelFor(score: number): SentimentLabel {
  if (score > 0.25) return 'positive';
  if (score < -0.25) return 'negative';
  return 'neutral';
}

function issue(id: IssueId, label: string, description: string): DetectedIssue {
  return { id, label, description };
}

const ISSUE_CATALOG: Record<
  IssueId,
  { label: string; description: string }
> = {
  hate_speech: {
    label: 'Hate speech',
    description:
      'Language targeting people based on identity (race, religion, gender, sexuality, disability).',
  },
  harassment: {
    label: 'Harassment / bullying',
    description: 'Personal attacks or abusive language aimed at an individual.',
  },
  profanity: {
    label: 'Profanity',
    description: 'Vulgar or strong language that may be inappropriate.',
  },
  negative_tone: {
    label: 'Negative tone',
    description:
      'A notably negative sentiment, though not necessarily hateful or abusive.',
  },
};

/**
 * Analyze a single comment completely on-device. The returned payload is shown
 * in the per-comment NoH8 modal.
 */
export function analyzeCommentText(
  comment: Pick<CommentData, 'id' | 'text'>
): CommentAnalysis {
  const tokens = tokenize(comment.text);

  const positiveCount = containsAny(tokens, POSITIVE_WORDS);
  const negativeCount = containsAny(tokens, NEGATIVE_WORDS);
  const hateCount = containsAny(tokens, HATE_WORDS);
  const harassmentCount = containsAny(tokens, HARASSMENT_WORDS);
  const profanityCount = containsAny(tokens, PROFANITY_WORDS);

  // Sentiment: balanced ratio of positive to negative words, mapped to [-1, 1].
  const sentimentScore =
    positiveCount + negativeCount === 0
      ? 0
      : (positiveCount - negativeCount) / (positiveCount + negativeCount);
  const sentiment: Sentiment = {
    score: sentimentScore,
    label: labelFor(sentimentScore),
  };

  // Hate speech: strongly driven by explicit hate words, supplemented by
  // repeated harassment signals.
  const hateScore =
    hateCount > 0
      ? clamp(0.6 + hateCount * 0.1, 0, 1)
      : harassmentCount >= 2
        ? clamp(0.4 + harassmentCount * 0.05, 0, 1)
        : 0;
  const isHateSpeech = hateScore > 0;

  const issues: DetectedIssue[] = [];
  if (hateCount > 0) {
    issues.push(issue('hate_speech', ISSUE_CATALOG.hate_speech.label, ISSUE_CATALOG.hate_speech.description));
  }
  if (harassmentCount > 0) {
    issues.push(issue('harassment', ISSUE_CATALOG.harassment.label, ISSUE_CATALOG.harassment.description));
  }
  if (profanityCount > 0) {
    issues.push(issue('profanity', ISSUE_CATALOG.profanity.label, ISSUE_CATALOG.profanity.description));
  }
  if (sentiment.label === 'negative' && issues.length === 0) {
    issues.push(issue('negative_tone', ISSUE_CATALOG.negative_tone.label, ISSUE_CATALOG.negative_tone.description));
  }

  return { commentId: comment.id, sentiment, isHateSpeech, hateSpeechScore: hateScore, issues };
}