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
* **Tests:** Vitest (47 files / 376 tests currently passing)

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
- [x] Vitest suites / **376 tests passing** (run with `npm test`)

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

### M11 — Docs & release polish *(documentation, release hygiene)* ✅ DONE

All functional milestones (T1–T6, M7–M10) shipped; the repository was ready for
a first tagged release but the version lived in three drifting locations and
the docs lagged behind M9/M10.

- [x] Version bumped `0.1.0` → `0.2.0` in **all three** locations that must stay
  in lockstep: `package.json`, `public/manifest.json`, and the `defineManifest()`
  in `vite.config.ts` (the CRX plugin generates `dist/manifest.json` from it).
- [x] `tests/unit/releaseVersion.test.ts` — release-gate suite: valid semver,
  release version present in each of the three locations, three-way sync, and
  version preservation through `buildFirefoxManifest`. Cutting a future release
  means bumping `EXPECTED_VERSION` in this suite alongside the three files.
- [x] README feature list now documents M9 (false-positive dismissal, JSON
  export) and M10 (inference scheduling).
- [x] `docs/ARCHITECTURE.md` module map covers `inferenceScheduler.ts`,
  `flagExport.ts`, and the sidepanel Dismiss action.
- [x] Firefox packaging verified: `npm run build` + `npm run package:firefox`
  produce `dist-firefox/` with a correct transformed manifest (gecko settings,
  background scripts, sidebar_action).
- [x] Acceptance: `releaseVersion.test.ts` (6 tests) green; full `npm run check`
  green; Firefox package inspected.

### M12 — Onboarding & first-run experience *(UX, permissions flow)* ✅ DONE

NoH8 requires optional per-platform host permissions, but a fresh install drops
the user into an empty state: no granted permissions, no model downloaded, and
no explanation of what the extension does. First-run friction directly costs
activation.

- [x] First-install welcome flow: on `chrome.runtime.onInstalled` (details.reason
      === `install`), open a dedicated `welcome.html` page (new React surface
      sharing the settings store).
- [x] Welcome page walks the user through: (1) what NoH8 does / privacy promise,
      (2) toggling each platform — which triggers the existing
      `src/permissions/` optional-permission request, (3) nudging a first model
      download via the existing `modelStore`/`client.ts` command path.
- [x] Completion state persisted (`noh8_onboarded` in `chrome.storage.local`);
      background setup skips re-opening the page once set.
- [x] Sidepanel / popup empty states link to the welcome page when nothing is
      enabled or no model is ready.
- [x] Acceptance: unit tests for the onboarding flag helpers (set/get/skip
      semantics), a `.tsx` suite for the welcome flow component (toggles invoke
      the permission mock, completion persists the flag, "skip" also persists),
      and a background-setup test that the welcome page opens only for
      `install` reasons and only when not yet onboarded.
      (`tests/unit/onboarding.test.ts` — 10 tests, `tests/unit/Welcome.test.tsx`
      — 5 tests, `tests/unit/backgroundSetup.test.ts` M12 block — 3 tests,
      `tests/unit/SettingsPopup.test.tsx` + `tests/unit/Sidepanel.test.tsx`
      empty-state nudge tests.)

### M13 — Local feedback calibration *(detection quality, privacy-preserving learning)* ✅ DONE

False-positive dismissals (M9) currently only hide comments. The user's
corrections are a signal that should improve future scoring — without any
server round-trip.

- [x] `src/offscreen/calibration.ts`: pure, DI-injected
      `createCalibration({ storage, defaults })` that derives per-model
      threshold adjustments from the persisted dismissal keys
      (`noh8_dismissed_flags`): each local dismissal nudges the flag threshold
      up by a small bounded step (clamped, e.g. +0.02 per dismissal, max +0.2),
      converging instead of running away.
- [x] Calibration applies at result-ingestion time in the offscreen pipeline:
      `CommentAnalysis` below the calibrated threshold is downgraded to
      `not_flagged` (the raw score stays available for the modal).
- [x] Fully resettable: the settings page exposes "Reset learned calibration",
      clearing only the derived thresholds (dismissal history is untouched).
- [x] No new permissions, no network, no telemetry — everything derives from
      data already on the device.
- [x] Acceptance: unit tests for threshold derivation (monotonic, clamped,
      converging steps, reset-to-defaults), an offscreen ingestion test that a
      calibrated-below-threshold analysis is downgraded, and an architecture
      guard test asserting `calibration.ts` imports no network modules.
      (`tests/unit/calibration.test.ts` — 18 tests, plus 2 SettingsPage
      reset-calibration tests.) Full `npm run check` green.

### M14 — Reply-thread & context analysis *(detection quality, adapters)* ✅ DONE

Comment-level classification ignores context: a reply quoting an insult to
denounce it can be flagged, while sarcastic abuse in context can be missed.

- [x] Shared context-merge seam `src/content/analysis/threadContext.ts`:
      `truncateParentContext` (500-char prefix cap on parent text) and
      `mergeCommentAnalyses` (conservative flag-either merge: max score, issues
      unioned/deduped by id, more-negative sentiment wins) — the single source
      of merge semantics for BOTH the model path and the heuristic fallback.
      `CommentData` extended with `parentText?` / `depth?` / `parentId?`
      (`src/shared/types.ts`), `AnalyzeRequest` with `parentText?`
      (`src/shared/messages.ts`), and `UiElement` with an optional structural
      `tagName` (`src/shared/uiTypes.ts`).
- [x] Adapter contract extended (no selector strings touched): new pure module
      `src/content/adapters/replyContext.ts` resolves reply ancestors two ways
      — `findAncestorByTagName` + `firstDescendantByTagName` for YouTube's
      sibling-thread shape, and `findParsedAncestor` (containment walk over
      already-parsed elements) for Instagram/Facebook nested containers.
      `youtubeAdapter` now parses thread containers into top-level + replies
      with `parentId`/`parentText`/`depth`; `instagramAdapter` and
      `facebookAdapter` resolve nested replies via containment with
      depth-chaining (reply-to-reply → depth 2); TikTok stays flat by design.
- [x] `inferenceScheduler` schedules parent-before-child: a reply whose
      `parentId` has not been scheduled yet is deferred (tracked in
      `pendingChildren`, counted by `pendingCount`), released when the parent
      is scheduled, and additionally enqueued directly after its parent in the
      FIFO queue so parents always drain first. `SchedulableComment` carries
      `parentText`/`depth`/`parentId`.
- [x] Offscreen pipeline context mode (`analyzeComment`): for replies the model
      runs twice — reply alone, then truncated-parent + reply — and the two
      analyses are merged via `mergeCommentAnalyses` before calibration;
      heuristic fallback receives `parentText` for the same semantics.
- [x] Heuristic fallback (`sentimentAnalyzer.ts`): `analyzeCommentText` gains a
      context-aware path — quoted-denial detection (parent carries an abusive
      term + reply carries a negation marker) downgrades the false positive,
      otherwise the reply-alone and reply-with-context runs merge
      conservatively. No-context input is byte-identical to the old behaviour.
- [x] Content-script wiring (`content/index.ts`) passes `parentText`/`parentId`
      from the adapter's `CommentData` into the scheduler.
- [x] Acceptance: `tests/unit/threadContext.test.ts` (11), heuristic context
      tests in `sentimentAnalyzer.test.ts` (6), scheduler parent-before-child
      + deferred-pendingCount tests (4), offscreen dual-run/merge/truncation
      tests in `offscreenContext.test.ts` (6), wire-forwarding tests in
      `offscreenClient.test.ts` + `inferenceClient.test.ts` (5),
      `replyContext.test.ts` (9), and adapter matrix tests in
      `youtubeAdapter.test.ts` (3) / `instagramAdapter.test.ts` (2) /
      `facebookAdapter.test.ts` (1). Full `npm run check` green
      (45 files / 350 tests + typecheck + production build).

### M15 — Accessibility & internationalization *(injected UI quality, reach)* ✅ DONE

The injected rainbow buttons, warning banners, and modals are visual-only:
no ARIA semantics, no keyboard path, and all strings are hard-coded English.

- [x] Injected UI: every interactive element has a role + `aria-label`
      (`createRainbowButton`, `renderDraftReviewButton`, modal close/report
      buttons); the modal card is `role="dialog"` + `aria-modal`; full keyboard
      operability (`Escape` closes the modal, focus returns to the trigger on
      every close path); and `prefers-reduced-motion` handling for the
      rainbow animation via `injectRainbowMotionStyles` + `.noh8-rainbow-animated`.
- [x] `src/shared/i18n.ts`: typed message catalog (`t(key, params?)`) with
      `en` as the source of truth; all user-facing strings in `content/ui`,
      `sidepanel`, and `settings` route through it. Locale resolves from
      `chrome.i18n.getUILanguage()` with an `en` fallback — no new permissions.
- [x] Pure-TS catalog chosen as the single seam: `default_locale`/`_locales`
      is deliberately NOT used, so the catalog in `src/shared/i18n.ts` is the
      only source. `chrome.i18n.getUILanguage()` is consumed read-only.
- [x] Acceptance: `tests/unit/injectedA11y.test.ts` asserts roles/labels/focus
      + `Escape`/focus-restore; `tests/unit/i18n.test.ts` covers catalog
      completeness (every key non-empty), param interpolation, unknown-key and
      unknown-locale fallback, and `resolveLocale()` (chrome → `navigator` →
      `en`); `tests/unit/i18nBoundary.test.ts` is the lint-style architecture
      test asserting the i18n seam import + no raw `textContent` literals in
      `content/ui`. `npm run check` green (typecheck + 303 tests + build).

---

## 6. Suggested Load Order for an AI Assistant

All of T1–T6 and M7–M11 are DONE. For the new work, recommended order:

1. **M12** (onboarding) — self-contained UX surface; no pipeline changes, low
   risk, immediate user-activation payoff.
2. **M15** (a11y & i18n) — introduce the `i18n.ts` seam *before* M12–M14 add
   more English string literals that would have to be migrated later.
   (If you want to minimize rework above all else, do M15 first.)
3. **M13** (calibration) — builds directly on M9's dismissal keys; small pure
   module plus one ingestion hook.
4. **M14** (thread context) — touches the shared `CommentData` type, adapter
   contract, scheduler, and inference pipeline; largest blast radius, do last
   and per-platform.

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
---

## Next Milestones (post-M14 roadmap)

The M7–M16 arc is complete; the milestones below extend robustness, quality,
and usability on the same privacy-first constraints (no network beyond the
sanctioned Hugging Face Hub model fetch, no telemetry, no new host origins
without sign-off).

### M16 — Offscreen health & model-download recovery *(robustness)* ✅ DONE

A failed or interrupted model download previously surfaced as a silent
heuristic fallback with no recovery path in the UI.

- [x] `src/settings/modelFailure.ts`: pure classifier mapping an unknown
      download error to `network | corrupt | quota | unknown` from message
      fragments.
- [x] `modelStore`: `modelFailures` map + `setModelFailure(id, kind | null)`;
      transient in-memory UI state (never persisted — the persisted `error`
      status alone is enough to re-derive that a retry is possible).
      `markModelDownloaded` clears any recorded failure.
- [x] `ModelManager.tsx`: classified failure explanation per model and a
      **Retry download** button that re-runs `requestModelCommand('download', …)`;
      a stale-selection warning (`role="alert"`) appears when the persisted
      `selectedModelId` no longer resolves in `MODEL_CATALOG`.
- [x] `src/shared/inferenceHealth.ts`: local-only seam
      (`chrome.storage.local` + `onChanged`, never synced, no network)
      recording `{ fallbackActive, modelId, updatedAt }` for the last
      inference. `offscreen/inference.ts` records `fallbackActive: false` on
      model success and `true` in the heuristic-fallback catch path.
- [x] `Sidepanel.tsx`: "Heuristic fallback — model unavailable" badge driven by
      the health record (initial read + live subscription).
- [x] Acceptance mapping: failure-kind classification →
      `tests/unit/modelFailure.test.ts` (12); store state machine
      (record/clear/never-persisted/cleared-on-success) →
      `tests/unit/modelStore.test.ts` M16 block (4); retry interaction +
      network/quota classification + stale-selection warning →
      `tests/unit/ModelManager.test.tsx` M16 block (6); health-seam
      round-trip/subscription/no-sync guard → `tests/unit/inferenceHealth.test.ts`
      (6); fallback badge shown/hidden → `tests/unit/Sidepanel.test.tsx`
      M16 block (2); offscreen records fallback on failure and clears on
      success → `tests/unit/inferenceDownload.test.ts` M16 block (2).
      No new permissions and no network beyond the sanctioned Hugging Face Hub
      fetch. `npm run check` green (47 files / 376 tests + typecheck + build).

### M17 — Multi-model consensus *(detection quality)* ⬜ TODO

A single model is a single point of failure for both false positives and false
negatives.

- [ ] Allow selecting a secondary model in settings; when both are downloaded,
      run consensus scoring (flag only if both agree; keep per-model scores in
      the analysis modal).
- [ ] Reuse the scheduler: consensus runs are two inferences per comment, so
      the concurrency cap and cache must key on `commentId::text::modelId`.
- [ ] Acceptance: consensus merge unit tests (agree/disagree/quorum),
      scheduler cache-key test, settings tests for secondary-model selection.

### M18 — On-device performance telemetry *(transparency, local-only)* ⬜ TODO

M10 made scanning fast but invisible; users can't see what a scan costs.

- [ ] Record per-comment inference latency and queue-wait in memory; persist a
      rolling histogram to `chrome.storage.local` (local-only, never synced).
- [ ] Surface a "Performance" section in settings (median/p95 latency, cache
      hit rate) with a reset button.
- [ ] Acceptance: histogram aggregation unit tests; storage round-trip test;
      settings rendering test; architecture guard test asserting no
      `chrome.storage.sync` and no network use in the telemetry module.

### M19 — Settings search & keyboard shortcuts *(usability)* ⬜ TODO

The settings page keeps growing (models, platforms, calibration, telemetry);
finding a toggle is getting hard.

- [ ] Filter-as-you-type search over settings sections (pure client-side
      matching over the existing `src/shared/i18n.ts` catalog keys).
- [ ] Keyboard shortcuts for common actions (open sidepanel, toggle platform)
      via the `commands` API — requires a `public/manifest.json` change, so
      coordinate per the boundaries in AGENTS.md before adding commands.
- [ ] Acceptance: search unit tests (match, no-match, diacritics); shortcut
      registration test against the manifest; `npm run check` green.
