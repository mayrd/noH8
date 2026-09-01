import type { UiElement } from './uiTypes';

export interface CommentData {
  id: string;
  platform: 'youtube' | 'instagram' | 'facebook' | 'tiktok';
  author: string;
  text: string;
  timestamp?: string;
  /**
   * (M14) Text of the parent comment in the thread, when this comment is a
   * reply. Used to score the reply *with context* (the parent text is
   * prepended to the model/heuristic input). Undefined for top-level
   * comments and flat-thread platforms (e.g. TikTok).
   */
  parentText?: string;
  /**
   * (M14) Nesting depth in the comment thread: 0 for a top-level comment,
   * 1 for a direct reply, 2 for a reply-to-a-reply, etc. Undefined when the
   * platform or adapter doesn't expose depth.
   */
  depth?: number;
  /**
   * (M14) Stable id of this comment's parent, when this comment is a reply.
   * Drives the scheduler's parent-before-child ordering (M14). Undefined for
   * top-level comments.
   */
  parentId?: string;
  /** Structural reference to the comment's container element in the page DOM.
   * Kept structural (see `shared/uiTypes.ts`) so adapters never need casts;
   * real-DOM consumers cross the boundary via `shared/domBridge.ts`. */
  elementRef?: UiElement;
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