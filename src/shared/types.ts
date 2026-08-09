export interface CommentData {
  id: string;
  platform: 'youtube' | 'instagram' | 'facebook' | 'tiktok';
  author: string;
  text: string;
  timestamp?: string;
  elementRef?: HTMLElement;
}

export interface AnalysisResult {
  commentId: string;
  isHateSpeech: boolean;
  score: number;
  label: string;
}

/** Continuous sentiment label derived from a score in [-1, 1]. */
export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface Sentiment {
  /** Continuous sentiment score in the range -1 (very negative) .. +1 (very positive). */
  score: number;
  label: SentimentLabel;
}

/** The kinds of issues the on-device detector can surface. */
export type IssueId =
  | 'hate_speech'
  | 'harassment'
  | 'profanity'
  | 'negative_tone';

export interface DetectedIssue {
  id: IssueId;
  label: string;
  description: string;
}

/**
 * Full on-device analysis produced for a single comment. Everything here is
 * computed locally in the user's browser; no text ever leaves the page.
 */
export interface CommentAnalysis {
  commentId: string;
  sentiment: Sentiment;
  isHateSpeech: boolean;
  /** Confidence (0..1) that the comment contains hate speech. */
  hateSpeechScore: number;
  issues: DetectedIssue[];
}