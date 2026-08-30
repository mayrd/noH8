import React, { useEffect, useState } from 'react';
import {
  useFlagStore,
  filterFlaggedComments,
  initFlagStore,
  type FlaggedComment,
} from './flagStore';
import type { IssueId } from '../shared/types';
import { MSG } from '../shared/messages';
import { buildReportUrl, PLATFORM_LABELS, type ReportPlatform } from '../content/ui/reportHelper';
import { dismissFlaggedComment } from './flagStore';
import { exportFlagsToJson, flagsExportFileName } from './flagExport';

/** Opens the first-run welcome page in a new tab. */
function openWelcomePage(): void {
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
}

const ISSUE_OPTIONS: Array<{ value: IssueId | 'all'; label: string }> = [
  { value: 'all', label: 'All Issues' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'profanity', label: 'Profanity' },
  { value: 'negative_tone', label: 'Negative Tone' },
];

export const Sidepanel: React.FC = () => {
  const {
    comments,
    activeUrl,
    activeTabId,
    filterIssue,
    sortBy,
    setActiveUrl,
    setActiveTabId,
    setFilterIssue,
    setSortBy,
    clearActiveComments,
    clearAllComments,
  } = useFlagStore();

  const [scope, setScope] = useState<'page' | 'all'>('page');
  const [jumpStatus, setJumpStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    void initFlagStore();

    // Query the active tab to scope comments to current URL
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          if (tabs[0].url) setActiveUrl(tabs[0].url);
          if (tabs[0].id) setActiveTabId(tabs[0].id);
        }
      });
    }
  }, [setActiveUrl, setActiveTabId]);

  const displayedComments = filterFlaggedComments(comments, {
    url: scope === 'page' && activeUrl ? activeUrl : undefined,
    issue: filterIssue,
    sortBy,
  });

  const handleJump = async (comment: FlaggedComment): Promise<void> => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) {
      return;
    }

    const tabId = activeTabId;
    if (!tabId) return;

    try {
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: MSG.HIGHLIGHT_COMMENT,
        commentId: comment.commentId,
      })) as { ok?: boolean; error?: string };

      if (!response?.ok) {
        setJumpStatus((prev) => ({ ...prev, [comment.id]: 'Not visible on page' }));
        setTimeout(() => {
          setJumpStatus((prev) => {
            const next = { ...prev };
            delete next[comment.id];
            return next;
          });
        }, 3000);
      }
    } catch {
      setJumpStatus((prev) => ({ ...prev, [comment.id]: 'Tab not ready' }));
    }
  };

  const handleReport = (comment: FlaggedComment): void => {
    const url = buildReportUrl(comment.platform as ReportPlatform, {
      id: comment.commentId,
      platform: comment.platform,
    });
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDismiss = async (comment: FlaggedComment): Promise<void> => {
    await dismissFlaggedComment(comment.id);
  };

  const handleExport = (): void => {
    const json = exportFlagsToJson(comments);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = flagsExportFileName();
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const percent = (score: number): string => `${Math.round(score * 100)}%`;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌈</span>
          <div>
            <h1 className="font-bold text-base leading-none text-white">NoH8</h1>
            <span className="text-xs text-slate-400">Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
            {displayedComments.length} flagged
          </span>
        </div>
      </header>

      {/* Filter and Scope Controls */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/90 space-y-2 text-xs">
        <div className="flex gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            className={`flex-1 py-1 px-2 rounded-md font-medium transition ${
              scope === 'page'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setScope('page')}
          >
            Current Page
          </button>
          <button
            type="button"
            className={`flex-1 py-1 px-2 rounded-md font-medium transition ${
              scope === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setScope('all')}
          >
            All Pages ({comments.length})
          </button>
        </div>

        <div className="flex gap-2">
          <select
            value={filterIssue}
            onChange={(e) => setFilterIssue(e.target.value as IssueId | 'all')}
            className="flex-1 bg-slate-950 border border-slate-700 text-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500"
            aria-label="Filter issues"
          >
            {ISSUE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'score')}
            className="bg-slate-950 border border-slate-700 text-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500"
            aria-label="Sort comments"
          >
            <option value="newest">Newest</option>
            <option value="score">Highest Score</option>
          </select>
        </div>
      </div>

      {/* Flagged comments list */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3">
        {displayedComments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <span className="text-3xl mb-2">🛡️</span>
            <p className="font-semibold text-slate-200 text-sm">No flagged comments</p>
            <p className="text-xs mt-1 text-slate-500">
              {scope === 'page'
                ? 'No hate speech detected on this page yet.'
                : 'Your review list is empty.'}
            </p>
            <button
              type="button"
              onClick={openWelcomePage}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition"
            >
              Set up NoH8
            </button>
          </div>
        ) : (
          displayedComments.map((comment) => (
            <article
              key={comment.id}
              className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-2.5 transition shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-300">
                    {comment.author || 'Anonymous'}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                    {PLATFORM_LABELS[comment.platform as ReportPlatform] || comment.platform}
                  </span>
                </div>
                <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  {percent(comment.hateSpeechScore)}
                </span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed break-words bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80">
                &ldquo;{comment.text}&rdquo;
              </p>

              {comment.issues.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {comment.issues.map((issue) => (
                    <span
                      key={issue.id}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700"
                    >
                      {issue.label}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-800/60">
                <div className="text-[11px] text-slate-500">
                  {jumpStatus[comment.id] && (
                    <span className="text-amber-400">{jumpStatus[comment.id]}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleJump(comment)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  >
                    Jump
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDismiss(comment)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReport(comment)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition"
                  >
                    Report
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </main>

      {/* Footer Actions */}
        <footer className="p-3 border-t border-slate-800 bg-slate-950 flex justify-between items-center text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void (scope === 'page' ? clearActiveComments() : clearAllComments())}
              className="text-slate-400 hover:text-rose-400 transition"
            >
              Clear {scope === 'page' ? 'page flags' : 'all flags'}
            </button>
            {comments.length > 0 && (
              <button
                type="button"
                onClick={handleExport}
                className="text-slate-400 hover:text-indigo-300 transition"
              >
                Export JSON
              </button>
            )}
          </div>
          <span className="text-slate-500 text-[11px]">100% on-device</span>
        </footer>
    </div>
  );
};

export default Sidepanel;
