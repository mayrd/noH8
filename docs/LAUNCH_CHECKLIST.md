# NoH8 Launch Checklist

Use this checklist when preparing a store submission or a public release.
Every item maps to a gate in `IMPLEMENTATION_PLAN.md` §8.4 (L4).

## Version hygiene (release gate)

- [ ] `package.json` `version` matches `public/manifest.json` `version` and
      `vite.config.ts` `defineManifest()` `version`.
- [ ] `tests/unit/releaseVersion.test.ts` `EXPECTED_VERSION` matches the three
      locations above and the suite passes.
- [ ] The bump is a real semver change (patch for fixes, minor for features,
      major for breaking). Never ship the same version twice to a store.

## Chrome Web Store

- [ ] `dist/` is a fresh production build (`npm run build`).
- [ ] `public/manifest.json` matches what `vite.config.ts` `defineManifest()`
      produces (the `releaseVersion.test.ts` suite covers the version; eyeball
      the rest when the manifest changes).
- [ ] Description in the manifest is single-purpose and matches the store listing.
- [ ] `host_permissions` in the manifest match the platforms the listing claims
      to support (driven by `src/content/platformConfig.ts`).
- [ ] Screenshots / promo images are current.
- [ ] Privacy disclosure (see below) is reflected in the store listing.

## Firefox Add-ons (AMO)

- [ ] `npm run package:firefox` produces `dist-firefox/` with a transformed
      manifest (`browser_specific_settings.gecko`, `background.scripts`,
      `sidebar_action`, no `sidePanel` permission).
- [ ] `tests/unit/firefoxManifest.test.ts` passes (covers the transform).
- [ ] Listing screenshots are current.
- [ ] Privacy disclosure (see below) is reflected in the AMO listing.

## Privacy disclosure (derived from `docs/ARCHITECTURE.md`)

NoH8 is privacy-first and runs 100% on-device:

- All inference runs locally in an offscreen document via
  `@xenova/transformers` (ONNX WebAssembly/WebGPU). No comment text, analysis
  result, or user data is sent to any server.
- The **only** network use is downloading ML models from the Hugging Face Hub
  (into `chrome.storage.local`, on the user's behalf, when the user opts in).
- No telemetry, no analytics, no crash reporting, no remote configuration.
- `chrome.storage.sync` is used only for user preferences (enabled platforms,
  draft-review toggle, calibration thresholds). Flagged-comment and model-state
  data lives in `chrome.storage.local` and never leaves the browser.
- No third-party scripts, no tracking, no ads.

When filling out a store's privacy questionnaire, mark data collection as
**no** for browsing history, cookies, and personal data; mark data use as
**no** for data sharing with third parties; and describe model downloads as the
sole network activity.

## Pre-release verification

- [ ] `npm run check` is green (typecheck + all tests + production build).
- [ ] `docs/PLATFORM_VERIFICATION.md` reflects the current acceptance-criteria
      matrix (`IMPLEMENTATION_PLAN.md` §8.5) for the platforms being shipped.
- [ ] The release commit message references the milestone(s) it ships.

## Post-release

- [ ] Tag the release in git and publish per `.github/workflows/release.yml`.
- [ ] Update `IMPLEMENTATION_PLAN.md` to mark the shipped milestone(s) done.
