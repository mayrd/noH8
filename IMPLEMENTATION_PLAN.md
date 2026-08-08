# `NoH8` Browser Extension — Implementation Plan

## 1. Project Overview
**NoH8** is an open-source, client-side browser extension designed to assist users in detecting and flagging hate speech while browsing social media platforms (YouTube, Instagram, Facebook, TikTok).

All machine learning inferences are performed **100% locally on the client's machine** using WebAssembly/WebGPU via `Transformers.js`, ensuring privacy and avoiding external API costs or data leaks.

---

## 2. Tech Stack & Prerequisites

* **Extension Specification:** Chrome Extension Manifest v3
* **Framework / Build System:** React 18 + TypeScript + Vite + `@crxjs/vite-plugin`
* **Styling:** Tailwind CSS
* **ML / On-Device NLP:** `@xenova/transformers` (running in an Offscreen Document / Web Worker using ONNX runtime)
* **DOM Observation:** `MutationObserver` API with platform-specific selector adapters

---

## 3. Architecture & Data Flow

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          NoH8 Chrome Extension                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────┐               ┌────────────────────────────┐  │
│  │    Content Script    │ ─── (Text) ─► │     Offscreen Document     │  │
│  │ (DOM Parsing/Inject) │               │   (Transformers.js NLP)    │  │
│  └──────────┬───────────┘               └─────────────┬──────────────┘  │
│             │                                         │                 │
│             ▼                                         ▼                 │
│  ┌──────────────────────┐               ┌────────────────────────────┐  │
│  │ Inline DOM Highlights│ ◄── (Score) ──│     Sidepanel / Popup      │  │
│  └──────────────────────┘               └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Content Scripts:** Monitor the active tab DOM for rendered comments using MutationObserver. Extract comment text, author, and element references.

**Offscreen Document:** Receives text payloads via `chrome.runtime.sendMessage`, passes them to the local ONNX pipeline, and returns toxicity scores.

**UI Overlay:** Content script receives the score; if toxicity exceeds the threshold (≥ 0.75), it injects visual warning tags and quick-action buttons.

**Sidepanel Dashboard:** Displays an aggregated list of flagged comments on the active page for batch review and reporting.

---

## 4. Repository Structure

```
noh8-extension/
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── background/
│   │   └── serviceWorker.ts       # Extension lifecycle & messaging router
│   ├── offscreen/
│   │   ├── offscreen.html
│   │   └── pipeline.ts            # Transformers.js model initialization & inference
│   ├── content/
│   │   ├── index.ts               # Content script entry point
│   │   └── adapters/
│   │       ├── baseAdapter.ts     # Abstract platform interface
│   │       ├── youtubeAdapter.ts  # YouTube selector logic
│   │       ├── instagramAdapter.ts# Instagram selector logic
│   │       ├── facebookAdapter.ts # Facebook selector logic
│   │       └── tiktokAdapter.ts   # TikTok selector logic
│   ├── sidepanel/
│   │   ├── Sidepanel.tsx          # React Sidepanel Dashboard
│   │   └── main.tsx
│   ├── shared/
│   │   ├── types.ts               # Shared TypeScript interfaces
│   │   └── constants.ts           # Thresholds & message types
│   └── styles/
│       └── main.css
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 5. Phased Implementation Roadmap

### Phase 1: Core Foundation & ML Pipeline (Day 1)
- [ ] Initialize Vite + React + TypeScript + Tailwind project with `@crxjs/vite-plugin`.
- [ ] Configure Manifest v3 (`manifest.json`) with permissions (`sidePanel`, `offscreen`, `storage`, `activeTab`).
- [ ] Set up the Offscreen Document hosting `@xenova/transformers`.
- [ ] Load a small multilingual model (e.g., XLM-RoBERTa-base-hate-speech or toxic-bert) and verify local inference execution time (< 150ms target).

### Phase 2: YouTube Platform Adapter & In-DOM Ingestion (Day 2)
- [ ] Implement `BaseAdapter` interface with methods: `getComments()`, `injectBadge()`, `observeNewComments()`.
- [ ] Create `YouTubeAdapter` targeting `ytd-comment-thread-renderer`.
- [ ] Wire message bridge between content script -> service worker -> offscreen document.
- [ ] Add inline DOM highlighting (e.g., red badge next to flagged comments).

### Phase 3: Multi-Platform Adapter Matrix (Day 3-4)
- [ ] Implement `InstagramAdapter` targeting dynamic list items and feed comments.
- [ ] Implement `FacebookAdapter` targeting `div[role="article"]` elements.
- [ ] Implement `TikTokAdapter` targeting `p[data-e2e="comment-level-1"]`.
- [ ] Build a fallback selector mechanism to handle minor class name updates gracefully.

### Phase 4: Sidepanel Dashboard & Assisted Reporting (Day 5)
- [ ] Build React-based Chrome Sidepanel interface.
- [ ] Display real-time count and card list of detected hate speech items on the current tab.
- [ ] Add "Quick Jump" button to auto-scroll directly to the flagged comment.
- [ ] Add "Report Assistant" button that opens the native platform reporting modal with pre-focused guidance.

---

## 6. Key Code Specs for AI Guidance

### `src/shared/types.ts`

```typescript
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
  score: number; // 0.0 - 1.0
  label: string;
}
```

### `src/content/adapters/baseAdapter.ts`

```typescript
export abstract class BaseAdapter {
  abstract platformName: string;
  abstract extractComments(): CommentData[];
  abstract injectWarning(commentId: string, result: AnalysisResult): void;
  abstract observe(onNewCommentsFound: (comments: CommentData[]) => void): void;
}
```

---

## 7. Next Steps for Vibe Coding

To begin development with an AI assistant (e.g., Cursor / Copilot):

1. Create the repository root folder.
2. Initialize Git and add this `IMPLEMENTATION_PLAN.md`.
3. Feed Phase 1 directly into your AI prompt:

> "Set up a Vite + React + TypeScript extension template matching Phase 1 of IMPLEMENTATION_PLAN.md, including Manifest v3 configuration with offscreen document support."
