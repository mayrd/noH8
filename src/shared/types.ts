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