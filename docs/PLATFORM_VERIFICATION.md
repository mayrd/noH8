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

Status: **0 / 85 cells verified** (3 cells are best-effort "B" and ship
with a documented caveat in Known-Limitations, L5).

## Legend

- **GA** = must pass before launch. **B** = best-effort, ship with a caveat.
- Browser version: e.g. `Chrome 128`, `Firefox 130`.
## Flow 1 — Reading & analysing comments

| id | criterion | target | grade | date | browser | version | result | drift notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| comments-primary | Comments extracted via primary selectors (text, author, stable id) | youtube | GA | — | — | — | pending | — |
| comments-primary | Comments extracted via primary selectors (text, author, stable id) | instagram | GA | — | — | — | pending | — |
| comments-primary | Comments extracted via primary selectors (text, author, stable id) | facebook | GA | — | — | — | pending | — |
| comments-primary | Comments extracted via primary selectors (text, author, stable id) | tiktok | GA | — | — | — | pending | — |
| comments-secondary | Secondary selectors still extract when primary drifts (selectorStrategy) | youtube | GA | — | — | — | pending | — |
| comments-secondary | Secondary selectors still extract when primary drifts (selectorStrategy) | instagram | GA | — | — | — | pending | — |
| comments-secondary | Secondary selectors still extract when primary drifts (selectorStrategy) | facebook | GA | — | — | — | pending | — |
| comments-secondary | Secondary selectors still extract when primary drifts (selectorStrategy) | tiktok | GA | — | — | — | pending | — |
| comments-unmatched | Unmatched DOM returns [] without throwing; drift logged (console.warn) | youtube | GA | — | — | — | pending | — |
| comments-unmatched | Unmatched DOM returns [] without throwing; drift logged (console.warn) | instagram | GA | — | — | — | pending | — |
| comments-unmatched | Unmatched DOM returns [] without throwing; drift logged (console.warn) | facebook | GA | — | — | — | pending | — |
| comments-unmatched | Unmatched DOM returns [] without throwing; drift logged (console.warn) | tiktok | GA | — | — | — | pending | — |
| comments-observer | MutationObserver picks up infinite-scroll / thread-expansion additions, deduped by id | youtube | GA | — | — | — | pending | — |
| comments-observer | MutationObserver picks up infinite-scroll / thread-expansion additions, deduped by id | instagram | GA | — | — | — | pending | — |
| comments-observer | MutationObserver picks up infinite-scroll / thread-expansion additions, deduped by id | facebook | GA | — | — | — | pending | — |
| comments-observer | MutationObserver picks up infinite-scroll / thread-expansion additions, deduped by id | tiktok | GA | — | — | — | pending | — |
| replies-context | Reply threads carry parentId/parentText/depth and merge conservatively | youtube | GA | — | — | — | pending | — |
| replies-context | Reply threads carry parentId/parentText/depth and merge conservatively | instagram | GA | — | — | — | pending | — |
| replies-context | Reply threads carry parentId/parentText/depth and merge conservatively | facebook | GA | — | — | — | pending | — |
| replies-context | Reply threads carry parentId/parentText/depth and merge conservatively | tiktok | B | — | — | — | pending | best-effort — ship with documented caveat |
| analysis-fallback | Offscreen-model analysis renders in modal; model-down → heuristic fallback + sidepanel badge | youtube | GA | — | — | — | pending | — |
| analysis-fallback | Offscreen-model analysis renders in modal; model-down → heuristic fallback + sidepanel badge | instagram | GA | — | — | — | pending | — |
| analysis-fallback | Offscreen-model analysis renders in modal; model-down → heuristic fallback + sidepanel badge | facebook | GA | — | — | — | pending | — |
| analysis-fallback | Offscreen-model analysis renders in modal; model-down → heuristic fallback + sidepanel badge | tiktok | GA | — | — | — | pending | — |
| rainbow-a11y | Rainbow button a11y: role, aria-label, keyboard, modal Escape/focus-restore | youtube | GA | — | — | — | pending | — |
| rainbow-a11y | Rainbow button a11y: role, aria-label, keyboard, modal Escape/focus-restore | instagram | GA | — | — | — | pending | — |
| rainbow-a11y | Rainbow button a11y: role, aria-label, keyboard, modal Escape/focus-restore | facebook | GA | — | — | — | pending | — |
| rainbow-a11y | Rainbow button a11y: role, aria-label, keyboard, modal Escape/focus-restore | tiktok | GA | — | — | — | pending | — |
| calibration | Calibration: dismissing a false positive raises that class threshold (resettable) | youtube | GA | — | — | — | pending | — |
| calibration | Calibration: dismissing a false positive raises that class threshold (resettable) | instagram | GA | — | — | — | pending | — |
| calibration | Calibration: dismissing a false positive raises that class threshold (resettable) | facebook | GA | — | — | — | pending | — |
| calibration | Calibration: dismissing a false positive raises that class threshold (resettable) | tiktok | GA | — | — | — | pending | — |
## Flow 2 — Reporting comments

| id | criterion | target | grade | date | browser | version | result | drift notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| report-url | Modal "Report on <Platform>" opens the correct per-platform URL in a new tab (noopener) | youtube | GA | — | — | — | pending | — |
| report-url | Modal "Report on <Platform>" opens the correct per-platform URL in a new tab (noopener) | instagram | GA | — | — | — | pending | — |
| report-url | Modal "Report on <Platform>" opens the correct per-platform URL in a new tab (noopener) | facebook | GA | — | — | — | pending | — |
| report-url | Modal "Report on <Platform>" opens the correct per-platform URL in a new tab (noopener) | tiktok | GA | — | — | — | pending | — |
| report-evidence | Evidence snippet copied to clipboard before navigation (L2) | youtube | GA | — | — | — | pending | — |
| report-evidence | Evidence snippet copied to clipboard before navigation (L2) | instagram | GA | — | — | — | pending | — |
| report-evidence | Evidence snippet copied to clipboard before navigation (L2) | facebook | GA | — | — | — | pending | — |
| report-evidence | Evidence snippet copied to clipboard before navigation (L2) | tiktok | GA | — | — | — | pending | — |
| report-label | Button label derives from comment.platform (i18n’d, en fallback) | youtube | GA | — | — | — | pending | — |
| report-label | Button label derives from comment.platform (i18n’d, en fallback) | instagram | GA | — | — | — | pending | — |
| report-label | Button label derives from comment.platform (i18n’d, en fallback) | facebook | GA | — | — | — | pending | — |
| report-label | Button label derives from comment.platform (i18n’d, en fallback) | tiktok | GA | — | — | — | pending | — |
| report-sidepanel | Sidepanel card Report action uses the same buildReportUrl mapping | youtube | GA | — | — | — | pending | — |
| report-sidepanel | Sidepanel card Report action uses the same buildReportUrl mapping | instagram | GA | — | — | — | pending | — |
| report-sidepanel | Sidepanel card Report action uses the same buildReportUrl mapping | facebook | GA | — | — | — | pending | — |
| report-sidepanel | Sidepanel card Report action uses the same buildReportUrl mapping | tiktok | GA | — | — | — | pending | — |
| report-removed | Report works after the comment element is removed from the DOM (URL from persisted platform) | youtube | GA | — | — | — | pending | — |
| report-removed | Report works after the comment element is removed from the DOM (URL from persisted platform) | instagram | GA | — | — | — | pending | — |
| report-removed | Report works after the comment element is removed from the DOM (URL from persisted platform) | facebook | GA | — | — | — | pending | — |
| report-removed | Report works after the comment element is removed from the DOM (URL from persisted platform) | tiktok | GA | — | — | — | pending | — |
## Flow 3 — Reviewing own comment draft (pre-post)

| id | criterion | target | grade | date | browser | version | result | drift notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| composer-match | Composer matched by adapter commentTextareaSelector (textarea OR contenteditable) | youtube | GA | — | — | — | pending | — |
| composer-match | Composer matched by adapter commentTextareaSelector (textarea OR contenteditable) | instagram | GA | — | — | — | pending | — |
| composer-match | Composer matched by adapter commentTextareaSelector (textarea OR contenteditable) | facebook | GA | — | — | — | pending | — |
| composer-match | Composer matched by adapter commentTextareaSelector (textarea OR contenteditable) | tiktok | GA | — | — | — | pending | — |
| composer-single | Review button rendered once per composer; SPA re-render yields a fresh button, never duplicates | youtube | GA | — | — | — | pending | — |
| composer-single | Review button rendered once per composer; SPA re-render yields a fresh button, never duplicates | instagram | GA | — | — | — | pending | — |
| composer-single | Review button rendered once per composer; SPA re-render yields a fresh button, never duplicates | facebook | GA | — | — | — | pending | — |
| composer-single | Review button rendered once per composer; SPA re-render yields a fresh button, never duplicates | tiktok | GA | — | — | — | pending | — |
| draft-read | Draft text read correctly (value vs textContent) and analysed through the scheduler | youtube | GA | — | — | — | pending | — |
| draft-read | Draft text read correctly (value vs textContent) and analysed through the scheduler | instagram | GA | — | — | — | pending | — |
| draft-read | Draft text read correctly (value vs textContent) and analysed through the scheduler | facebook | GA | — | — | — | pending | — |
| draft-read | Draft text read correctly (value vs textContent) and analysed through the scheduler | tiktok | GA | — | — | — | pending | — |
| draft-empty | Empty draft → i18n "nothing to review" note, no inference call (L3) | youtube | GA | — | — | — | pending | — |
| draft-empty | Empty draft → i18n "nothing to review" note, no inference call (L3) | instagram | GA | — | — | — | pending | — |
| draft-empty | Empty draft → i18n "nothing to review" note, no inference call (L3) | facebook | GA | — | — | — | pending | — |
| draft-empty | Empty draft → i18n "nothing to review" note, no inference call (L3) | tiktok | GA | — | — | — | pending | — |
| draft-flagged | Flagged draft shows warning state in the modal before posting (L3) | youtube | GA | — | — | — | pending | — |
| draft-flagged | Flagged draft shows warning state in the modal before posting (L3) | instagram | GA | — | — | — | pending | — |
| draft-flagged | Flagged draft shows warning state in the modal before posting (L3) | facebook | GA | — | — | — | pending | — |
| draft-flagged | Flagged draft shows warning state in the modal before posting (L3) | tiktok | GA | — | — | — | pending | — |
| composer-spa | Composer discovery survives SPA navigation via adapter observation (L3) | youtube | GA | — | — | — | pending | — |
| composer-spa | Composer discovery survives SPA navigation via adapter observation (L3) | instagram | GA | — | — | — | pending | — |
| composer-spa | Composer discovery survives SPA navigation via adapter observation (L3) | facebook | B | — | — | — | pending | best-effort — ship with documented caveat |
| composer-spa | Composer discovery survives SPA navigation via adapter observation (L3) | tiktok | B | — | — | — | pending | best-effort — ship with documented caveat |
## Cross-platform (both browsers)

| id | criterion | target | grade | date | browser | version | result | drift notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| check-green | npm run check green (typecheck + tests + build) | chrome | GA | — | — | — | pending | — |
| check-green | npm run check green (typecheck + tests + build) | firefox | GA | — | — | — | pending | — |
| firefox-package | npm run package:firefox produces a correct transformed manifest | firefox | GA | — | — | — | pending | — |
| offscreen-relay | Offscreen document created on install; messages relayed with relayed dedup | chrome | GA | — | — | — | pending | — |
| offscreen-relay | Offscreen document created on install; messages relayed with relayed dedup | firefox | GA | — | — | — | pending | — |
| permissions-flow | Optional host permissions requested per platform via welcome-flow toggles | chrome | GA | — | — | — | pending | — |
| permissions-flow | Optional host permissions requested per platform via welcome-flow toggles | firefox | GA | — | — | — | pending | — |
| no-network | No network beyond Hugging Face model fetch; no chrome.storage.sync for flags/telemetry (architecture guard tests) | chrome | GA | — | — | — | pending | — |
| no-network | No network beyond Hugging Face model fetch; no chrome.storage.sync for flags/telemetry (architecture guard tests) | firefox | GA | — | — | — | pending | — |
