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

### T1 — Implement real adapters: YouTube, Facebook, TikTok *(highest priority)* ✅ DONE

**YouTube**
- [x] `extractComments()`: parse `ytd-comment-thread-renderer` → comments; resolve author via `#author-text`, text via `#content-text`, id from the thread/link.
- [x] `observe()`: return existing comments on boot, then watch the `ytd-comments` container with `MutationObserver` for infinite-scroll additions (dedupe by id).
- [x] `injectWarning()`: append a `[data-noh8-warning]` banner to the flagged comment (reuse Instagram's structural-DOM style).
- [x] Acceptance: unit tests mirroring `tests/unit/instagramAdapter.test.ts` — extraction, dedupe (no dupes on re-scan), id stability, warning-skip-on-duplicate, empty-when-no-Nodes (`youtubeAdapter.test.ts` — 8 tests).

**Facebook**
- [x] `extractComments()`: parse `div[role="article"]` / comment thread containers; robust to obfuscated class names (lean on `role`/`dir`/`aria-*` where possible).
- [x] `observe()` mutation watching for dynamic thread expansion.
- [x] `injectWarning()` banner.
- [x] Acceptance: same unit-test matrix as Instagram, with Facebook selectors (`facebookAdapter.test.ts` — 8 tests).

**TikTok**
- [x] `extractComments()`: parse `p[data-e2e="comment-level-1"]` containers; author from nearby handle.
- [x] `observe()` for lazy-loaded comment sections.
- [x] `injectWarning()` banner.
- [x] Acceptance: same unit-test matrix, with TikTok selectors (`tiktokAdapter.test.ts` — 8 tests).

**Registry / wiring**
- [x] Ensure `getEnabledAdapters()` loads the three new adapters (test via `registry.test.ts`).
- [x] Confirm content-script boot log reports all enabled platforms.

### T2 — Fallback selector mechanism *(robustness) ✅ DONE

Instagram already notes that social DOMs are obfuscated and change often. Make that
graceful for all adapters.

- [x] Add a fallback-try chain: try the primary structural selector set, then documented secondary selectors, then return zero comments (never throw).
- [x] Log a one-time `console.warn` when a primary selector yields nothing so regressions are visible, but keep scanning.
- [x] Add a shared helper (e.g. `content/adapters/selectorStrategy.ts`) reused by every adapter.
- [x] Acceptance: unit test that a mocked DOM matching only secondary selectors still extracts comments; and that an unmatched DOM returns `[]` without throwing (`selectorStrategy.test.ts` — 9 tests).
### T3 — Sidepanel dashboard ✅ DONE

- [x] Add `src/sidepanel/Sidepanel.tsx` + `main.tsx`; register `sidepanel.html` in `vite.config.ts` rollup input and in the manifest (`side_panel.default_path`).
- [x] Add `sidePanel` permission to the manifest (and mirror in `firefoxManifest.test.ts` / Firefox path).
- [x] **Aggregation:** `sidepanel/flagStore.ts` writing to `chrome.storage.local` to record each flagged `CommentAnalysis`.
- [x] UI: card list of flagged comments for the **active tab** and all pages, real-time count header, live updates via `chrome.storage.onChanged`.
- [x] **Quick Jump:** each card's "Jump" button sends a `noh8:highlightComment` message to the content script which scrolls to the flagged comment's element and highlights it with a pulse border.
- [x] Acceptance: unit tests for the flag store (`flagStore.test.ts` — 5 tests) and Sidepanel UI (`Sidepanel.test.tsx` — 5 tests).

### T4 — Report Assistant & per-platform reporting ✅ DONE

The modal's report action was hardcoded to Instagram — `buildCommentReportUrl()`
returned `https://www.instagram.com/report/` and the button always said "Report on Instagram"
regardless of platform. Now fully per-platform via `src/content/ui/reportHelper.ts`.

- [x] Make report guidance **per-platform**: add `buildReportUrl(platform, comment)` covering YouTube, Instagram, Facebook, TikTok (use stable help/report gates where deep-links are unavailable, documented in `reportHelper.ts`).
- [x] Button label derives from the comment platform (e.g. Report on YouTube).
- [x] Add a per-platform reporting helper with unit tests over each URL mapping (`reportHelper.test.ts` — 6 tests).
- [x] Pass `comment.platform` through the content-script → `renderCommentControls` flow (already available on `CommentData`) — `commentUi.ts` now calls `reportActionLabel(comment.platform)` and `buildReportUrl(comment.platform, comment)`.

### T5 — Align inline-warning UX with adapters *(consistency)* ✅ DONE

- [x] Standardize flow: `renderCommentControls()` provides the rainbow action button and interactive modal; `adapter.injectWarning()` provides direct DOM warning banners on high-confidence flags without duplicates.
- [x] Update the README feature list and architecture to match shipped components.
- [x] Acceptance: `commentUi.test.ts` + adapter tests green; strict TypeScript compliance across all adapter seams.

### T6 — QA, docs & release finalization ✅ DONE

- [x] Strict TypeScript configuration enabled (`strict: true` in `tsconfig.json`).
- [x] Run `npm run typecheck` / `npm run check` clean with zero errors across all 28 test suites (198 tests passing).
- [x] Updated **README** feature list and command reference.
- [x] Verified Firefox packaging via `npm run package:firefox`.

### M7 — DOM-boundary hardening *(tech debt, AGENTS.md §5)* ✅ DONE

Eliminate every ad-hoc `as unknown as X` cast at the DOM boundary in `src/`.

- [x] Move the structural `UiElement` / `UiDocument` / `UiWindow` interfaces to
  `src/shared/uiTypes.ts` as the single source of truth, extended with the
  adapter-facing members (`getAttribute`, `querySelectorAll`, `scrollIntoView`)
  and widened `style`/`dataset` value types; `content/ui/uiTypes.ts` re-exports
  them so existing UI import paths keep working.
- [x] Consolidate the four duplicated per-adapter `ElementLike` definitions and
  `selectorStrategy.ts`'s copy onto the shared `UiElement` type (local aliases
  keep the existing names/exports).
- [x] Make `CommentData.elementRef` structural (`UiElement`) so adapters assign
  `elementRef: item` directly — four casts removed.
- [x] Add `src/shared/domBridge.ts` (`asUiElement` / `asUiDocument` /
  `asUiWindow`): the single documented unsafe seam for real-DOM → structural
  crossings; `content/index.ts` now uses it instead of inline double casts.
- [x] Acceptance: `tests/unit/domBoundary.test.ts` — an architecture guard that
  fails if `as unknown as` / `as any` appears in any `src/` file other than the
  bridge, plus identity-passthrough unit tests for the three bridge functions
  (4 tests). Full suite green; `npm run check` clean.

### M8 — Lazy Transformers.js loading *(bundle-size tech debt, AGENTS.md §5)* ✅ DONE

Kill the offscreen entry chunk bloat caused by the static
`import { pipeline, env } from '@xenova/transformers'` in `inference.ts`
(~818 kB entry chunk, Vite >500 kB warning).

- [x] Add `src/offscreen/transformersLoader.ts`: a memoized, lazy dynamic
  importer of `@xenova/transformers` that also owns the MV3-CSP `env`
  configuration (remote models on, local off, browser cache on,
  `numThreads = 1`, `proxy = false`) applied once on load; failed imports are
  not cached (next call retries).
- [x] `src/offscreen/inference.ts` now reaches Transformers.js only through
  the loader; its static import and module-load-time env block are gone.
- [x] Raise `build.chunkSizeWarningLimit` to 900 in `vite.config.ts` — the only
  remaining >500 kB chunk is the deliberately lazy transformers runtime.
- [x] Acceptance: `tests/unit/transformersLoader.test.ts` (lazy import +
  env config, memoization across concurrent/sequential calls, retry after
  failure), `tests/unit/lazyTransformersBoundary.test.ts` (architecture guard:
  no static `@xenova/transformers` import in `inference.ts`, loader-only
  access), updated `inferenceEnv.test.ts` (env config asserted through the
  loader). Build: offscreen entry chunk 818 kB → ~3 kB; transformers in a
  separate on-demand chunk; full `npm run check` green.

### M9 — False-positive dismissal & data export *(sidepanel UX, privacy ownership)* ✅ DONE

The dashboard recorded every flag forever with no user recourse: a false
positive re-appeared on every rescan, and users had no way to take their data
with them. Now the user controls the signal.

- [x] `flagStore.ts`: persisted false-positive dismissals — `dismissFlaggedComment(id)`
  removes the flag and records a stable `commentId::url` dismissal key in
  `chrome.storage.local` (`noh8_dismissed_flags`); `recordFlaggedComment()`
  returns `null` (records nothing) for dismissed comments; `dismissalKeyFor()`
  is the single identity-key helper; `getDismissedKeys()` exposes them.
- [x] Clear semantics: a **global** clear wipes dismissals too (fresh start);
  **scoped** (per-URL/tab) clears retain them.
- [x] `src/sidepanel/flagExport.ts`: pure `exportFlagsToJson(comments)`
  (newest-first, internal DOM references stripped, `exportedAt`/`count`
  metadata) and `flagsExportFileName()` (`noh8-flags-YYYY-MM-DD.json`).
- [x] `Sidepanel.tsx`: per-card **Dismiss** button and an **Export JSON**
  download in the footer (Blob + anchor download, no extra permissions).
- [x] Acceptance: `flagStore.test.ts` (dismissal persistence, no re-record
  after dismissal, other comments unaffected, global-vs-scoped clear
  semantics — 4 new tests), `flagExport.test.ts` (valid JSON payload with all
  fields, newest-first ordering, empty payload, no `elementRef` leak, filename
  format — 5 tests), `Sidepanel.test.tsx` (Dismiss removes the flag; Export
  creates a JSON Blob download — 2 new tests). Full `npm run check` green.

### M10 — Scan performance & inference throttling *(content-script performance)* ✅ DONE

Adapter observers can surface comment bursts (infinite scroll, thread
expansion) and every comment hit the offscreen pipeline immediately and
unconditionally; re-scans re-inferred already-analysed comments.

- [x] `src/content/analysis/inferenceScheduler.ts`: pure, DI-injected
  `createInferenceScheduler({ infer, concurrency = 2 })` returning
  `schedule` / `pendingCount` / `clearCache`. Caps concurrent inferences
  (FIFO queue), deduplicates concurrent schedules for the same comment onto a
  single in-flight promise, caches completed analyses by `commentId::text`
  (mirroring `flagStore.dismissalKeyFor`), never caches failures (retry on
  next schedule), and `clearCache()` resets.
- [x] `src/content/index.ts` now routes both the comment-observation and the
  draft-review inference paths through the scheduler (concurrency 2).
- [x] Acceptance: `tests/unit/inferenceScheduler.test.ts` — result
  passthrough, concurrency cap, FIFO start order, concurrent dedupe
  (identity-shared result), completed-result cache, text-sensitive cache
  key, failure isolation, no caching of failures, `pendingCount`,
  `clearCache` (10 tests). Full `npm run check` green (233 tests).

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