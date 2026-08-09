# `NoH8` Browser Extension — Implementation Plan

## 1. Project Overview

**NoH8** is an open-source, client-side browser extension that helps users detect and
flag hate speech while browsing social media (YouTube, Instagram, Facebook, TikTok).

All inference runs **100% locally on the client** via WebAssembly/WebGPU using
`Transformers.js` inside an offscreen document — no servers, no API costs, no data leaks.

> **Workflow rule (strict TDD):** every new feature/bug-fix below starts with
> failing tests (RED), then a minimal implementation that makes them pass (GREEN),
> then cleanup (REFACTOR). Never push without a fully green suite. See §7.

---

## 2. Tech Stack

* **Extension:** Chrome Manifest v3 (with a Firefox-compatible build path)
* **Framework/Build:** React 18 + TypeScript + Vite + `@crxjs/vite-plugin`
* **State:** Zustand (`settingsStore`, `modelStore`)
* **ML / On-Device NLP:** `@xenova/transformers` running in an **offscreen document** (ONNX wasm/WebGPU), plus a deterministic heuristic fallback
* **DOM Observation:** `MutationObserver` + per-platform selector adapters
* **Tests:** Vitest (14 suites / 77 tests currently passing)

---

## 3. Repository Structure (current)

```
noH8/
├── .github/workflows/        # test.yml (CI) + release.yml (GitHub Releases)
├── public/                   # manifest.json + icons
├── scripts/                  # icon generation + Firefox packaging
├── src/
│   ├── background/           # serviceWorker.ts + setup.ts (offscreen lifecycle/router)
│   ├── content/
│   │   ├── index.ts          # content-script entry: boots adapters, analyses comments
│   │   ├── platformConfig.ts # per-platform URL match patterns
│   │   ├── adapters/         # baseAdapter + youtube/instagram/facebook/tiktok + registry
│   │   ├── analysis/         # inferenceClient.ts (offscreen client) + sentimentAnalyzer.ts (heuristic)
│   │   └── ui/commentUi.ts   # rainbow button + analysis modal (structural DOM)
│   ├── offscreen/            # offscreen.html, index.ts, inference.ts, modelCatalog.ts, client.ts
│   ├── settings/             # settingsStore, modelStore, ModelManager, SettingsPage, popup
│   ├── permissions/          # per-platform optional-permission requests
│   └── shared/               # types.ts + messages.ts
├── popup.html / settings.html
├── tests/unit/               # 14 Vitest suites
├── vite.config.ts, vitest.config.ts, package.json, tsconfig.json
└── README.md
```

---

## 4. ✅ Already Done

Compact status of shipped work (verified against the repo + passing tests).

**Foundation & tooling**
- [x] Vite + React 18 + TypeScript + Tailwind + `@crxjs/vite-plugin` scaffold
- [x] Manifest v3 with `storage`, `scripting`, `offscreen` + scoped `host_permissions` / `optional_host_permissions`
- [x] Background service worker (`serviceWorker.ts` + `setup.ts`): runs install/startup setup and relays messages

**On-device ML pipeline (offscreen document)**
- [x] Offscreen document hosting `@xenova/transformers` (created on install, re-ensured on startup)
- [x] Curated **model catalog** (Toxic-BERT, multilingual sentiment, SST-2, Twitter RoBERTa) with `DEFAULT_MODEL_ID = 'toxic-bert'`
- [x] On-install model-selection seeding + model persistence in `chrome.storage.local` (`modelStore`)
- [x] Download / refresh / delete lifecycle + progress/status sync across contexts
- [x] Output → `CommentAnalysis` mapping (`modelCatalog.commentAnalysisFromOutputs`)
- [x] Deterministic **heuristic fallback** (`sentimentAnalyzer.ts`) when the model is unavailable

**Platform framework**
- [x] Abstract `BaseAdapter` + dynamic adapter registry (`import.meta.glob`)
- [x] Platform config + runtime optional-permission request flow
- [x] **Instagram adapter fully implemented** (comment extraction, author/id resolution, warning injection, MutationObserver) with 7 unit tests

**UI / settings**
- [x] Settings page (platform toggles + reset) and popup
- [x] Model Manager (switch / download / refresh / delete models)
- [x] Per-comment rainbow analyze button + analysis modal (structural DOM, Node-testable)

**Messaging & reliability**
- [x] Content → service worker → offscreen bridge (`shared/messages.ts`), dedup via `relayed` flag
- [x] Graceful fallback in content script when the pipe or model is unavailable

**Packaging & CI**
- [x] Firefox packaging script + Firefox manifest test
- [x] Icon generation script + tests
- [x] GitHub Actions: test workflow + release workflow (`latest` tag + GitHub Releases)

**Test health**
- [x] 14 Vitest suites / **77 tests passing** (run with `npm test`)

---

## 5. 📋 Detailed Todos

Remaining work, in priority order. Each group lists explicit sub-tasks **and
acceptance criteria** (which double as test requirements per the TDD rule).

### T1 — Implement real adapters: YouTube, Facebook, TikTok *(highest priority)*

Currently `youtubeAdapter.ts`, `facebookAdapter.ts`, `tiktokAdapter.ts` are stubs
(empty `extractComments`, no-op `observe`). Only Instagram is production-ready.

**YouTube**
- [ ] `extractComments()`: parse `ytd-comment-thread-renderer` → comments; resolve author via `#author-text`, text via `#content-text`, id from the thread/link.
- [ ] `observe()`: return existing comments on boot, then watch the `ytd-comments` container with `MutationObserver` for infinite-scroll additions (dedupe by id).
- [ ] `injectWarning()`: append a `[data-noh8-warning]` banner to the flagged comment (reuse Instagram's structural-DOM style).
- [ ] Acceptance: unit tests mirroring `tests/unit/instagramAdapter.test.ts` — extraction, dedupe (no dupes on re-scan), id stability, warning-skip-on-duplicate, empty-when-no-Nodes.

**Facebook**
- [ ] `extractComments()`: parse `div[role="article"]` / comment thread containers; robust to obfuscated class names (lean on `role`/`dir`/`aria-*` where possible).
- [ ] `observe()` mutation watching for dynamic thread expansion.
- [ ] `injectWarning()` banner.
- [ ] Acceptance: same unit-test matrix as Instagram, with Facebook selectors.

**TikTok**
- [ ] `extractComments()`: parse `p[data-e2e="comment-level-1"]` containers; author from nearby handle.
- [ ] `observe()` for lazy-loaded comment sections.
- [ ] `injectWarning()` banner.
- [ ] Acceptance: same unit-test matrix, with TikTok selectors.

**Registry / wiring**
- [ ] Ensure `getEnabledAdapters()` loads the three new adapters (test via `registry.test.ts`).
- [ ] Confirm content-script boot log reports all enabled platforms.

### T2 — Fallback selector mechanism *(robustness) ✅ DONE

Instagram already notes that social DOMs are obfuscated and change often. Make that
graceful for all adapters.

- [x] Add a fallback-try chain: try the primary structural selector set, then documented secondary selectors, then return zero comments (never throw).
- [x] Log a one-time `console.warn` when a primary selector yields nothing so regressions are visible, but keep scanning.
- [x] Add a shared helper (e.g. `content/adapters/selectorStrategy.ts`) reused by every adapter.
- [x] Acceptance: unit test that a mocked DOM matching only secondary selectors still extracts comments; and that an unmatched DOM returns `[]` without throwing (`selectorStrategy.test.ts` — 9 tests).
### T3 — Sidepanel dashboard *(not started — README overclaims this)*

There is currently **no sidepanel folder, no `chrome.sidePanel` usage, and no
`sidePanel` permission** in the manifest, yet the README lists "Sidepanel dashboard"
as a shipped feature. Build it properly.

- [ ] Add `src/sidepanel/Sidepanel.tsx` + `main.tsx`; register `sidepanel.html` in `vite.config.ts` rollup input and in the manifest (`side_panel.default_path`).
- [ ] Add `sidePanel` permission to the manifest (and mirror in `firefoxManifest.test.ts` / Firefox path if it applies).
- [ ] Open the panel after install / from the action (via `chrome.sidePanel.setPanelBehavior`).
- [ ] **Aggregation:** content script already analyses comments; add a shared store (e.g. `sidepanel/flagStore` writing to `chrome.storage.local`) to record each flagged `CommentAnalysis`.
- [ ] UI: card list of flagged comments for the **active tab**, real-time count header, live updates via `chrome.storage.onChanged`.
- [ ] **Quick Jump:** each card's button sends a message to the content script which scrolls to the flagged comment's element and highlights it briefly.
- [ ] Acceptance: unit tests for the flag store (add/clear, tab scoping, no duplicates) and any pure UI logic; MANUAL browser check on a real comments page.

### T4 — Report Assistant & per-platform reporting ✅ DONE

The modal's report action was hardcoded to Instagram — `buildCommentReportUrl()`
returned `https://www.instagram.com/report/` and the button always said "Report on Instagram"
regardless of platform. Now fully per-platform via `src/content/ui/reportHelper.ts`.

- [x] Make report guidance **per-platform**: add `buildReportUrl(platform, comment)` covering YouTube, Instagram, Facebook, TikTok (use stable help/report gates where deep-links are unavailable, documented in `reportHelper.ts`).
- [x] Button label derives from the comment platform (e.g. Report on YouTube).
- [x] Add a per-platform reporting helper with unit tests over each URL mapping (`reportHelper.test.ts` — 6 tests).
- [x] Pass `comment.platform` through the content-script → `renderCommentControls` flow (already available on `CommentData`) — `commentUi.ts` now calls `reportActionLabel(comment.platform)` and `buildReportUrl(comment.platform, comment)`.

### T5 — Align inline-warning UX with adapters *(consistency)*

Today the content script renders the rainbow button + modal via
`renderCommentControls()`, while each adapter also implements `injectWarning()`.
Pick and document one consistent path (recommendation: keep the button/modal as the
primary inline UI and drop the redundant adapter banner, **or** call
`injectWarning()` for high-confidence flags only).

- [ ] Decide the flow, then remove the unused branch so there is a single, tested inline-UI path.
- [ ] Update the README feature list to match reality (including the sidepanel fix in T3).
- [ ] Acceptance: existing `commentUi.test.ts` + adapter tests remain green; no dead code paths.

### T6 — QA, docs & release finalization

- [ ] Verify `<150ms` inference target on the default model; record a baseline and optimize (model size / quantization / WebGPU) if it misses.
- [ ] Full manual matrix: YouTube, Instagram, Facebook, TikTok pages — extraction, observation, inline UI, settings toggles, model lifecycle.
- [ ] Run `npm run lint` (`tsc --noEmit`) clean.
- [ ] Update **README** feature list to accurately reflect shipped vs. planned (fix sidepanel overclaim).
- [ ] Final `npm test` green → tag release and confirm the GitHub release workflow artifacts.

---

## 6. Suggested Load Order for an AI Assistant

1. **T1** (YouTube → Facebook → TikTok) — unblocks the multi-platform mission and mirrors the already-shipped Instagram adapter as a template (its tests are the blueprint).
2. **T2** — shared selector fallback, small and cross-cutting.
3. **T4** — per-platform reporting; small, localized (`commentUi.ts` + a helper).
4. **T3** — sidepanel dashboard; largest new surface, do after the adapters so there is real data to aggregate.
5. **T5 / T6** — consistency, docs and release cleanup last.

For each task, start with: *"Write failing unit tests for the behaviour in
[TASK], run `npm test` to confirm they fail, then implement until green."* Settings
of this repo follow the strict TDD protocol in §7.

---

## 7. Definition of Done (TDD protocol reminder)

- [ ] Failing test written FIRST and confirmed failing (`npm test` shows the new red test).
- [ ] Minimal implementation written; full suite green (`npm test`, zero failures).
- [ ] Refactor for clarity without breaking tests; `npm run lint` clean.
- [ ] Acceptance criteria for the task explicitly covered by a passing test.
- [ ] State exactly which acceptance criteria map to which test before any push.