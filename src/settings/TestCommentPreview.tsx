import React, { useEffect, useRef, useState } from 'react';
import { inferComment } from '../content/analysis/inferenceClient';
import { createRainbowButton } from '../content/ui/commentUi';
import { asUiDocument, asUiWindow, appendUiElement } from '../shared/domBridge';
import { t } from '../shared/i18n';
import type { CommentAnalysis, CommentData } from '../shared/types';

/** Injectable analyser so tests drive verdicts deterministically. */
export type PreviewAnalyze = (
  draft: Pick<CommentData, 'id' | 'text'>
) => Promise<CommentAnalysis>;

export interface TestCommentPreviewProps {
  analyze?: PreviewAnalyze;
}

const PREVIEW_ID = 'settings-test-preview';
/** Short debounce so typing feels instant but doesn't spam the pipeline. */
const ANALYZE_DEBOUNCE_MS = 250;

/**
 * "Try it out" playground for the settings page: an input box plus a
 * social-media-style comment preview with the real rainbow button.
 *
 * Typing runs the same `inferComment` pipeline as content scripts (on-device
 * model via the offscreen document, heuristic fallback otherwise). The
 * rainbow button is built by `createRainbowButton`, so clicking it opens the
 * identical analysis modal users see on social pages.
 */
const TestCommentPreview: React.FC<TestCommentPreviewProps> = ({
  analyze = inferComment,
}) => {
  const [text, setText] = useState<string>('');
  const [analysis, setAnalysis] = useState<CommentAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const rainbowHostRef = useRef<HTMLSpanElement | null>(null);
  const requestSeq = useRef<number>(0);

  const trimmed = text.trim();
  const comment: CommentData = {
    id: PREVIEW_ID,
    platform: 'youtube',
    author: t('settings.tryIt.author'),
    text: trimmed,
  };

  // Debounced analysis: only the latest request may update state, so fast
  // typing never shows a stale verdict for an older draft.
  useEffect(() => {
    if (trimmed.length === 0) {
      setAnalysis(null);
      setIsAnalyzing(false);
      return;
    }
    setIsAnalyzing(true);
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    const timer = window.setTimeout(() => {
      void analyze({ id: PREVIEW_ID, text: trimmed })
        .then((result) => {
          if (requestSeq.current === seq) setAnalysis(result);
        })
        .catch(() => {
          if (requestSeq.current === seq) setAnalysis(null);
        })
        .finally(() => {
          if (requestSeq.current === seq) setIsAnalyzing(false);
        });
    }, ANALYZE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [trimmed, analyze]);

  // Mount the real rainbow button into the preview row. The structural
  // builder creates a genuine DOM node, so cross the boundary via domBridge.
  const verdictKey = analysis === null ? 'none' : String(analysis.isHateSpeech);
  const verdictScore = analysis?.hateSpeechScore ?? 0;
  useEffect(() => {
    const host = rainbowHostRef.current;
    if (host === null || trimmed.length === 0 || analysis === null) return;
    host.innerHTML = '';
    const button = createRainbowButton(
      asUiDocument(document),
      { ...comment, text: trimmed },
      analysis,
      typeof window !== 'undefined' ? asUiWindow(window) : undefined
    );
    button.setAttribute?.('data-testid', 'test-preview-rainbow');
    if (rainbowHostRef.current !== null) appendUiElement(rainbowHostRef.current, button);
    return () => {
      host.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, verdictKey, verdictScore]);

  const statusText = ((): string | null => {
    if (trimmed.length === 0) return null;
    if (isAnalyzing || analysis === null) return t('settings.tryIt.analyzing');
    return analysis.isHateSpeech
      ? t('settings.tryIt.flagged')
      : t('settings.tryIt.clean');
  })();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
      <div>
        <label htmlFor="noh8-test-comment" className="block text-sm font-medium text-gray-800">
          {t('settings.tryIt.label')}
        </label>
        <input
          id="noh8-test-comment"
          type="text"
          value={text}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
          placeholder={t('settings.tryIt.placeholder')}
          autoComplete="off"
          className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-noh8-500"
        />
      </div>
      <div data-testid="test-preview-comment" className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
        {trimmed.length === 0 ? (
          <p className="text-sm text-gray-400">{t('settings.tryIt.empty')}</p>
        ) : (
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-noh8-100 text-sm font-semibold text-noh8-700">
              {t('settings.tryIt.author').slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-700">{t('settings.tryIt.author')}</p>
              <p className="mt-0.5 break-words text-sm text-gray-900">{trimmed}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span ref={rainbowHostRef} data-testid="test-preview-rainbow-host" className="inline-flex items-center" />
                {statusText !== null && (
                  <span data-testid="test-preview-status" role="status" className="text-xs text-gray-500">
                    {statusText}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestCommentPreview;

