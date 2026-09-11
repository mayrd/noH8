import { getEnabledAdapters } from './adapters/registry';
import { initSettingsStore, settingsStore } from '../settings/settingsStore';
import { initModelStore, modelStore } from '../settings/modelStore';
import { inferComment } from './analysis/inferenceClient';
import { createInferenceScheduler } from './analysis/inferenceScheduler';
import { analysisModelKey } from './analysis/consensus';
import { renderCommentControls } from './ui/commentUi';
import { renderDraftReviewButton } from './ui/commentUi';
import type { UiDocument, UiElement, UiWindow } from './ui/commentUi';
import type { Platform } from '../settings/types';
import { MSG } from '../shared/messages';
import { recordFlaggedComment } from '../sidepanel/flagStore';
import { asUiDocument, asUiElement, asUiWindow } from '../shared/domBridge';

const PLATFORMS: Platform[] = ['youtube', 'instagram', 'facebook', 'tiktok'];
const commentElementMap = new Map<string, UiElement>();

/**
 * Concurrency-limited, deduplicating front end for on-device inference
 * (M10). Adapter observers can surface comment bursts on infinite-scroll
 * pages; the scheduler caps concurrent pipeline requests and never
 * re-infers a comment that was already analysed on this page load.
 */
const scheduler = createInferenceScheduler({
  infer: (comment) => inferComment({ id: comment.commentId, text: comment.text }),
  concurrency: 2,
});

/**
 * Model configuration in force for newly scheduled comments (M17). Read
 * live from the shared model store — which is hydrated before `start()` and
 * stays in sync across contexts via `chrome.storage.onChanged` — so the
 * scheduler cache keys every entry to the exact model configuration that
 * computed it (primary id, or `primary+secondary` while consensus runs).
 */
function currentModelKey(): string {
  return analysisModelKey(modelStore.getState());
}

/**
 * Highlight and scroll to a comment element when requested by the sidepanel.
 */
export function highlightComment(commentId: string): boolean {
  const el = commentElementMap.get(commentId);
  if (!el || typeof el.scrollIntoView !== 'function' || !el.style) return false;

  const style = el.style;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const prevOutline = style.outline;
  const prevTransition = style.transition;

  style.transition = 'outline 0.2s ease-in-out';
  style.outline = '3px solid #ef4444';

  setTimeout(() => {
    style.outline = prevOutline;
    style.transition = prevTransition;
  }, 2500);

  return true;
}

/**
 * Content script entry point.
 *
 * Reads the enabled platforms from the settings store, then boots every
 * matching platform adapter so it can start observing comments on the page.
 * Each discovered comment is analysed on-device and gets a rainbow button
 * behind it that opens a modal explaining the analysis.
 */
function start(): void {
  const { enabledPlatforms } = settingsStore.getState();
  const enabled = PLATFORMS.filter((platform) => enabledPlatforms[platform]);

  // Listen for jump/highlight messages from the sidepanel
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === MSG.HIGHLIGHT_COMMENT && typeof message.commentId === 'string') {
        const found = highlightComment(message.commentId);
        sendResponse({ ok: found, error: found ? undefined : 'Comment not found on page' });
        return true;
      }
    });
  }

  getEnabledAdapters(enabled)
    .then((adapters) => {
      console.info(
        `[NoH8] monitoring ${adapters.length} platform(s): ${adapters
          .map((adapter) => adapter.platformName)
          .join(', ')}`
      );

      for (const adapter of adapters) {
        adapter.observe((comments) => {
          for (const comment of comments) {
            console.info(
              `[NoH8][${adapter.platformName}] comment by ${comment.author}: ${comment.text}`
            );
            // Skip comments we cannot attach a button to.
            const container = comment.elementRef;
            if (!container) continue;
            commentElementMap.set(comment.id, container);

            scheduler.schedule({
              commentId: comment.id,
              text: comment.text,
              // (M14) Thread context: parents are scheduled before their
              // replies and the reply is scored with its parent's text.
              parentText: comment.parentText,
              parentId: comment.parentId,
              // (M17) Scope the cache to the model configuration in force
              // when this comment is scheduled, so switching models (or the
              // consensus pair) re-infers instead of serving stale results.
              modelId: currentModelKey(),
            }).then((analysis) => {
              if (!comment.elementRef) return; // comment detached while analysing

              if (analysis.isHateSpeech || analysis.issues.length > 0) {
                void recordFlaggedComment({
                  commentId: comment.id,
                  platform: comment.platform,
                  author: comment.author,
                  text: comment.text,
                  url: typeof window !== 'undefined' ? window.location.href : '',
                  sentiment: analysis.sentiment,
                  isHateSpeech: analysis.isHateSpeech,
                  hateSpeechScore: analysis.hateSpeechScore,
                  issues: analysis.issues,
                });
              }

              if (
                analysis.isHateSpeech &&
                analysis.hateSpeechScore >= 0.85 &&
                typeof adapter.injectWarning === 'function'
              ) {
                adapter.injectWarning(comment.id, {
                  commentId: comment.id,
                  isHateSpeech: true,
                  score: analysis.hateSpeechScore,
                  label: analysis.issues[0]?.label || 'Hate speech detected',
                });
              }

              renderCommentControls({
                container,
                comment,
                analysis,
                doc: asUiDocument(document),
                windowRef: asUiWindow(window),
                heartButtonSelector: adapter.commentAnchorSelector,
              });
            });
          }
        });
      }

      // Setup rainbow button for comment draft textareas
      const enabledSetting = settingsStore.getState().reviewOwnCommentDrafts;
      if (enabledSetting) {
        adapters.forEach((adapter) => {
          const selector = adapter.commentTextareaSelector;
          if (!selector) return;
          const matches = Array.from(document.querySelectorAll<HTMLElement>(selector));
          matches.forEach((el) => {
            if (el.dataset?.['noh8DraftButton'] === 'true') return;
            renderDraftReviewButton({
              textarea: asUiElement(el),
              platform: adapter.platformName,
              doc: asUiDocument(document),
              windowRef: asUiWindow(window),
              analyze: (draft) =>
                scheduler.schedule({
                  commentId: draft.id,
                  text: draft.text,
                  // (M17) Draft reviews share the model-scoped cache.
                  modelId: currentModelKey(),
                }),
              author: 'You',
            });
          });
        });
      }
    })
    .catch((error) => {
      console.error('[NoH8] failed to initialise platform adapters:', error);
    });
}

// Hydrate persisted settings and model state (falls back to defaults when
// unavailable), then start monitoring the page.
Promise.all([initSettingsStore(), initModelStore()]).finally(start);