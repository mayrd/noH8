# Platform Verification Log (L1)

> **Protocol (L1):** every platform×flow cell of the §8.5 acceptance matrix
> (`IMPLEMENTATION_PLAN.md`) must be verified against the **live site** on
> Chrome and Firefox and recorded here. Each entry carries: **date, browser,
> version, platform, flow, pass/fail, and selector-drift notes**.
>
> A cell is only done when (1) a unit test for the criterion exists in the
> repo and passes (`npm test`), and (2) a live entry below records a pass on
> the required browsers. Regenerate the printable checklist anytime with
> `npm run verify` — it is rendered from `scripts/platformVerification.mjs`.
>
> For any failing cell, file a selector-drift fix through
> `selectorStrategy.ts` secondary selectors — never weaken existing adapter
> assertions — and add a fixture mirroring the new live DOM to that
> platform's adapter suite (RED→GREEN).

Status: **473 / 473 tests passing · 0 / 85 cells live-verified** (3 cells are
best-effort "B" and ship with a documented caveat in Known-Limitations, L5).

> **Test-coverage status (2026-09-11):** every GA cell has a passing unit test in
> the repo (see per-cell "test" column below). The live-verification column
> acknowledges that manual browser runs against the live sites are still
> required to close each cell — those are offloaded to a human verifier with
> a real Chrome/Firefox install. Run `npm run verify` to print the checklist.

## Legend

- **GA** = must pass before launch. **B** = best-effort, ship with a caveat.
- Browser version: e.g. `Chrome 128`, `Firefox 130`.
## Flow 1 — Reading & analysing comments

| id | criterion | target | grade | test | date | browser | version | result | drift notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| comments-primary | Comments extracted via primary selectors (text, author, stable id) | youtube | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| comments-primary | Comments extracted via primary selectors (text, author, stable id) | instagram | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| comments-primary | Comments extracted via primary selectors (text, author, stable id) | facebook | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| comments-primary | Comments extracted via primary selectors (text, author, stable id) | tiktok | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| comments-secondary | Secondary selectors still extract when primary drifts (selectorStrategy) | youtube | GA | selectorStrategy.test.ts | — | — | pending | — |
| comments-secondary | Secondary selectors still extract when primary drifts (selectorStrategy) | instagram | GA | selectorStrategy.test.ts | — | — | pending | — |
| comments-secondary | Secondary selectors still extract when primary drifts (selectorStrategy) | facebook | GA | selectorStrategy.test.ts | — | — | pending | — |
| comments-secondary | Secondary selectors still extract when primary drifts (selectorStrategy) | tiktok | GA | selectorStrategy.test.ts | — | — | pending | — |
| comments-unmatched | Unmatched DOM returns [] without throwing; drift logged (console.warn) | youtube | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| comments-unmatched | Unmatched DOM returns [] without throwing; drift logged (console.warn) | instagram | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| comments-unmatched | Unmatched DOM returns [] without throwing; drift logged (console.warn) | facebook | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| comments-unmatched | Unmatched DOM returns [] without throwing; drift logged (console.warn) | tiktok | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| comments-observer | MutationObserver picks up infinite-scroll / thread-expansion additions, deduped by id | youtube | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| comments-observer | MutationObserver picks up infinite-scroll / thread-expansion additions, deduped by id | instagram | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| comments-observer | MutationObserver picks up infinite-scroll / thread-expansion additions, deduped by id | facebook | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| comments-observer | MutationObserver picks up infinite-scroll / thread-expansion additions, deduped by id | tiktok | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| replies-context | Reply threads carry parentId/parentText/depth and merge conservatively | youtube | GA | replyContext.test.ts | — | — | pending | — |
| replies-context | Reply threads carry parentId/parentText/depth and merge conservatively | instagram | GA | replyContext.test.ts | — | — | pending | — |
| replies-context | Reply threads carry parentId/parentText/depth and merge conservatively | facebook | GA | replyContext.test.ts | — | — | pending | — |
| replies-context | Reply threads carry parentId/parentText/depth and merge conservatively | tiktok | B | replyContext.test.ts | — | — | pending | best-effort — ship with documented caveat |
| analysis-fallback | Offscreen-model analysis renders in modal; model-down → heuristic fallback + sidepanel badge | youtube | GA | inferenceHealth.test.ts / Sidepanel.test.tsx | — | — | pending | — |
| analysis-fallback | Offscreen-model analysis renders in modal; model-down → heuristic fallback + sidepanel badge | instagram | GA | inferenceHealth.test.ts / Sidepanel.test.tsx | — | — | pending | — |
| analysis-fallback | Offscreen-model analysis renders in modal; model-down → heuristic fallback + sidepanel badge | facebook | GA | inferenceHealth.test.ts / Sidepanel.test.tsx | — | — | pending | — |
| analysis-fallback | Offscreen-model analysis renders in modal; model-down → heuristic fallback + sidepanel badge | tiktok | GA | inferenceHealth.test.ts / Sidepanel.test.tsx | — | — | pending | — |
| rainbow-a11y | Rainbow button a11y: role, aria-label, keyboard, modal Escape/focus-restore | youtube | GA | injectedA11y.test.ts | — | — | pending | — |
| rainbow-a11y | Rainbow button a11y: role, aria-label, keyboard, modal Escape/focus-restore | instagram | GA | injectedA11y.test.ts | — | — | pending | — |
| rainbow-a11y | Rainbow button a11y: role, aria-label, keyboard, modal Escape/focus-restore | facebook | GA | injectedA11y.test.ts | — | — | pending | — |
| rainbow-a11y | Rainbow button a11y: role, aria-label, keyboard, modal Escape/focus-restore | tiktok | GA | injectedA11y.test.ts | — | — | pending | — |
| calibration | Calibration: dismissing a false positive raises that class threshold (resettable) | youtube | GA | calibration.test.ts | — | — | pending | — |
| calibration | Calibration: dismissing a false positive raises that class threshold (resettable) | instagram | GA | calibration.test.ts | — | — | pending | — |
| calibration | Calibration: dismissing a false positive raises that class threshold (resettable) | facebook | GA | calibration.test.ts | — | — | pending | — |
| calibration | Calibration: dismissing a false positive raises that class threshold (resettable) | tiktok | GA | calibration.test.ts | — | — | pending | — |
## Flow 2 — Reporting comments

| id | criterion | target | grade | test | date | browser | version | result | drift notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| report-url | Modal "Report on <Platform>" opens the correct per-platform URL in a new tab (noopener) | youtube | GA | reportHelper.test.ts / Sidepanel.test.tsx | — | — | pending | — |
| report-url | Modal "Report on <Platform>" opens the correct per-platform URL in a new tab (noopener) | instagram | GA | reportHelper.test.ts / Sidepanel.test.tsx | — | — | pending | — |
| report-url | Modal "Report on <Platform>" opens the correct per-platform URL in a new tab (noopener) | facebook | GA | reportHelper.test.ts / Sidepanel.test.tsx | — | — | pending | — |
| report-url | Modal "Report on <Platform>" opens the correct per-platform URL in a new tab (noopener) | tiktok | GA | reportHelper.test.ts / Sidepanel.test.tsx | — | — | pending | — |
| report-evidence | Evidence snippet copied to clipboard before navigation (L2) | youtube | GA | reportHelper.test.ts / Sidepanel.test.tsx | — | — | pending | — |
| report-evidence | Evidence snippet copied to clipboard before navigation (L2) | instagram | GA | reportHelper.test.ts / Sidepanel.test.tsx | — | — | pending | — |
| report-evidence | Evidence snippet copied to clipboard before navigation (L2) | facebook | GA | reportHelper.test.ts / Sidepanel.test.tsx | — | — | pending | — |
| report-evidence | Evidence snippet copied to clipboard before navigation (L2) | tiktok | GA | reportHelper.test.ts / Sidepanel.test.tsx | — | — | pending | — |
| report-label | Button label derives from comment.platform (i18n’d, en fallback) | youtube | GA | reportHelper.test.ts / i18n.test.ts | — | — | pending | — |
| report-label | Button label derives from comment.platform (i18n’d, en fallback) | instagram | GA | reportHelper.test.ts / i18n.test.ts | — | — | pending | — |
| report-label | Button label derives from comment.platform (i18n’d, en fallback) | facebook | GA | reportHelper.test.ts / i18n.test.ts | — | — | pending | — |
| report-label | Button label derives from comment.platform (i18n’d, en fallback) | tiktok | GA | reportHelper.test.ts / i18n.test.ts | — | — | pending | — |
| report-sidepanel | Sidepanel card Report action uses the same buildReportUrl mapping | youtube | GA | Sidepanel.test.tsx | — | — | pending | — |
| report-sidepanel | Sidepanel card Report action uses the same buildReportUrl mapping | instagram | GA | Sidepanel.test.tsx | — | — | pending | — |
| report-sidepanel | Sidepanel card Report action uses the same buildReportUrl mapping | facebook | GA | Sidepanel.test.tsx | — | — | pending | — |
| report-sidepanel | Sidepanel card Report action uses the same buildReportUrl mapping | tiktok | GA | Sidepanel.test.tsx | — | — | pending | — |
| report-removed | Report works after the comment element is removed from the DOM (URL from persisted platform) | youtube | GA | reportHelper.test.ts | — | — | pending | — |
| report-removed | Report works after the comment element is removed from the DOM (URL from persisted platform) | instagram | GA | reportHelper.test.ts | — | — | pending | — |
| report-removed | Report works after the comment element is removed from the DOM (URL from persisted platform) | facebook | GA | reportHelper.test.ts | — | — | pending | — |
| report-removed | Report works after the comment element is removed from the DOM (URL from persisted platform) | tiktok | GA | reportHelper.test.ts | — | — | pending | — |
## Flow 3 — Reviewing own comment draft (pre-post)

| id | criterion | target | grade | test | date | browser | version | result | drift notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| composer-match | Composer matched by adapter commentTextareaSelector (textarea OR contenteditable) | youtube | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| composer-match | Composer matched by adapter commentTextareaSelector (textarea OR contenteditable) | instagram | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| composer-match | Composer matched by adapter commentTextareaSelector (textarea OR contenteditable) | facebook | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| composer-match | Composer matched by adapter commentTextareaSelector (textarea OR contenteditable) | tiktok | GA | youtubeAdapter.test.ts / instagramAdapter.test.ts / facebookAdapter.test.ts / tiktokAdapter.test.ts | — | — | pending | — |
| composer-single | Review button rendered once per composer; SPA re-render yields a fresh button, never duplicates | youtube | GA | draftReview.test.ts / youtubeAdapter.test.ts (L3) / instagramAdapter.test.ts (L3) / facebookAdapter.test.ts (L3) / tiktokAdapter.test.ts (L3) | — | — | pending | — |
| composer-single | Review button rendered once per composer; SPA re-render yields a fresh button, never duplicates | instagram | GA | draftReview.test.ts / youtubeAdapter.test.ts (L3) / instagramAdapter.test.ts (L3) / facebookAdapter.test.ts (L3) / tiktokAdapter.test.ts (L3) | — | — | pending | — |
| composer-single | Review button rendered once per composer; SPA re-render yields a fresh button, never duplicates | facebook | GA | draftReview.test.ts / youtubeAdapter.test.ts (L3) / instagramAdapter.test.ts (L3) / facebookAdapter.test.ts (L3) / tiktokAdapter.test.ts (L3) | — | — | pending | — |
| composer-single | Review button rendered once per composer; SPA re-render yields a fresh button, never duplicates | tiktok | GA | draftReview.test.ts / youtubeAdapter.test.ts (L3) / instagramAdapter.test.ts (L3) / facebookAdapter.test.ts (L3) / tiktokAdapter.test.ts (L3) | — | — | pending | — |
| draft-read | Draft text read correctly (value vs textContent) and analysed through the scheduler | youtube | GA | draftReview.test.ts | — | — | pending | — |
| draft-read | Draft text read correctly (value vs textContent) and analysed through the scheduler | instagram | GA | draftReview.test.ts | — | — | pending | — |
| draft-read | Draft text read correctly (value vs textContent) and analysed through the scheduler | facebook | GA | draftReview.test.ts | — | — | pending | — |
| draft-read | Draft text read correctly (value vs textContent) and analysed through the scheduler | tiktok | GA | draftReview.test.ts | — | — | pending | — |
| draft-empty | Empty draft → i18n "nothing to review" note, no inference call (L3) | youtube | GA | draftReview.test.ts | — | — | pending | — |
| draft-empty | Empty draft → i18n "nothing to review" note, no inference call (L3) | instagram | GA | draftReview.test.ts | — | — | pending | — |
| draft-empty | Empty draft → i18n "nothing to review" note, no inference call (L3) | facebook | GA | draftReview.test.ts | — | — | pending | — |
| draft-empty | Empty draft → i18n "nothing to review" note, no inference call (L3) | tiktok | GA | draftReview.test.ts | — | — | pending | — |
| draft-flagged | Flagged draft shows warning state in the modal before posting (L3) | youtube | GA | draftReview.test.ts / injectedA11y.test.ts | — | — | pending | — |
| draft-flagged | Flagged draft shows warning state in the modal before posting (L3) | instagram | GA | draftReview.test.ts / injectedA11y.test.ts | — | — | pending | — |
| draft-flagged | Flagged draft shows warning state in the modal before posting (L3) | facebook | GA | draftReview.test.ts / injectedA11y.test.ts | — | — | pending | — |
| draft-flagged | Flagged draft shows warning state in the modal before posting (L3) | tiktok | GA | draftReview.test.ts / injectedA11y.test.ts | — | — | pending | — |
| composer-spa | Composer discovery survives SPA navigation via adapter observation (L3) | youtube | GA | youtubeAdapter.test.ts (L3) / instagramAdapter.test.ts (L3) | — | — | pending | — |
| composer-spa | Composer discovery survives SPA navigation via adapter observation (L3) | instagram | GA | youtubeAdapter.test.ts (L3) / instagramAdapter.test.ts (L3) | — | — | pending | — |
| composer-spa | Composer discovery survives SPA navigation via adapter observation (L3) | facebook | B | facebookAdapter.test.ts (L3) | — | — | pending | best-effort — ship with documented caveat |
| composer-spa | Composer discovery survives SPA navigation via adapter observation (L3) | tiktok | B | tiktokAdapter.test.ts (L3) | — | — | pending | best-effort — ship with documented caveat |
## Cross-platform (both browsers)

| id | criterion | target | grade | test | date | browser | version | result | drift notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| check-green | npm run check green (typecheck + tests + build) | chrome | GA | npm run check (473 tests / typecheck / build) | — | — | pending | — |
| check-green | npm run check green (typecheck + tests + build) | firefox | GA | npm run check (473 tests / typecheck / build) | — | — | pending | — |
| firefox-package | npm run package:firefox produces a correct transformed manifest | firefox | GA | firefoxManifest.test.ts / npm run package:firefox | — | — | pending | — |
| offscreen-relay | Offscreen document created on install; messages relayed with relayed dedup | chrome | GA | offscreenContext.test.ts / backgroundSetup.test.ts | — | — | pending | — |
| offscreen-relay | Offscreen document created on install; messages relayed with relayed dedup | firefox | GA | offscreenContext.test.ts / backgroundSetup.test.ts | — | — | pending | — |
| permissions-flow | Optional host permissions requested per platform via welcome-flow toggles | chrome | GA | permissions.test.ts / onboarding.test.ts | — | — | pending | — |
| permissions-flow | Optional host permissions requested per platform via welcome-flow toggles | firefox | GA | permissions.test.ts / onboarding.test.ts | — | — | pending | — |
| no-network | No network beyond Hugging Face model fetch; no chrome.storage.sync for flags/telemetry (architecture guard tests) | chrome | GA | architecture guard tests (multiple suites) / platformVerification.test.ts | — | — | pending | — |
| no-network | No network beyond Hugging Face model fetch; no chrome.storage.sync for flags/telemetry (architecture guard tests) | firefox | GA | architecture guard tests (multiple suites) / platformVerification.test.ts | — | — | pending | — |
