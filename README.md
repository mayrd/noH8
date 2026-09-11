# 🌈 Our Mission — Fighting Hate Speech, Empowering Everyone to Act

**NoH8 exists to fight hate speech and build safer, more inclusive spaces online.**

Every day, hate speech spreads across social platforms — targeting people by race, gender, sexuality, religion, disability, or identity. We believe no one should have to look away, and no one should be powerless against it.

**We built NoH8 to change that.**

NoH8 is a browser extension that uses privacy‑first, on‑device AI to detect hate speech in real time — on YouTube, Instagram, Facebook, and TikTok comments. **Nothing leaves your browser.** No servers, no API costs, no data leaks.

### Why flag content?

Because silence enables hate. Every flagged comment makes a difference:

- **Surface** harmful speech that platforms might miss.
- **Document** patterns of abuse for research and advocacy.
- **Empower** communities to protect themselves and others.

**Flagging is just as easy as looking.** With inline highlighting and a dedicated sidepanel dashboard, spotting and reporting abusive comments takes a single click. No forms, no logins, no friction.

Together, we can make the internet a place where everyone belongs.

---

# NoH8 — Client-Side Hate Speech Detection Browser Extension

**Privacy-first hate speech detection directly in your browser, 100% on-device.**

NoH8 uses `Transformers.js` with ONNX WebAssembly/WebGPU to analyze social media comments (YouTube, Instagram, Facebook, TikTok) for hate speech — all locally on your machine. Zero data leaves your browser.

## Features

- ✅ 100% local ML inference — no servers, no API costs, no data leaks
- ✅ Real on-device model via Transformers.js (WebAssembly/WebGPU) in an offscreen document
- ✅ Model Manager in Settings — download, refresh, delete, or switch models (Toxic-BERT, RoBERTa, SST-2, Multilingual)
- ✅ Graceful fallback to a built-in heuristic analyser while a model is downloading
- ✅ Multi-platform support: YouTube, Instagram, Facebook, TikTok
- ✅ Sidepanel dashboard for live comment aggregation, issue filtering, and "Jump to comment"
- ✅ Per-comment rainbow action buttons, detailed sentiment/issue modals, and draft review
- ✅ False-positive dismissal (per-comment) and one-click JSON export of flagged comments
- ✅ Concurrency-limited, deduplicating inference scheduler so comment bursts never overwhelm the pipeline
- ✅ Multi-model consensus — optionally require a downloaded second model to agree before a comment is flagged, with per-model scores in the analysis modal
- ✅ Chrome Manifest v3 extension with Firefox build path
- ✅ First-run welcome page: privacy promise, per-platform toggles, and a one-click first model download (never shown twice)
- ✅ Accessibility & i18n: ARIA `role`/`aria-label` semantics on injected buttons and the analysis modal, full keyboard path (`Escape` closes the modal and returns focus to the trigger), `prefers-reduced-motion` handling for the rainbow animation, and a typed single-source `i18n` catalog (`en`-first, locale resolved from `chrome.i18n.getUILanguage()` with no new permissions)

## On-device inference & model management

NoH8 runs a `text-classification` model inside an **offscreen document** so the heavy WebAssembly/WebGPU work never blocks the page. On first install the extension creates this offscreen document, seeds the default model selection, and starts serving analysis requests through a service-worker relay.

In the settings page you can:

- **Switch** the active model from a curated catalog (Toxic-BERT, DistilBERT multilingual sentiment, SST-2 sentiment, Twitter RoBERTa sentiment).
- **Download** a model for offline, instant use.
- **Refresh** a model (dispose + re-download) to recover from a failed download.
- **Delete** a model to free browser space.

If no model is downloaded (or a download fails), analysis transparently falls back to a fast, deterministic keyword heuristic so every comment is still scored.

## Tech Stack

- React 18 + Zustand + TypeScript (Strict Mode) + Vite (CRXJS)
- Tailwind CSS
- Transformers.js (ONNX runtime via WebAssembly/WebGPU)
- Chrome Extension Manifest v3 + Firefox MV3

## Commands

```bash
npm install               # Install dependencies
npm run dev               # Development mode with HMR
npm run build             # Production build in dist/
npm run check             # Unified check: typecheck + test + build
npm test                  # Run full Vitest suite
npm run package:firefox   # Package Firefox build in dist-firefox/
```

## Quick Start Guide

### Installation

1. **Download the extension:**
   - Chrome: Install from the [Chrome Web Store](https://chromewebstore.google.com) (coming soon)
   - Firefox: Install from [Firefox Add-ons](https://addons.mozilla.org) (coming soon)
   - Or load unpacked from `dist/` in developer mode

2. **Pin the extension** to your browser toolbar for easy access

### Welcome Flow (First Run)

When you first install NoH8, you'll see a **welcome page** that:

- Explains the privacy promise (100% on-device, no data leaves your browser)
- Lets you select which platforms to enable (YouTube, Instagram, Facebook, TikTok)
- Offers a one-click download of the default ML model (Toxic-BERT)
- This welcome page is shown only once

### Your First Scan

1. **Navigate to a supported platform** (YouTube, Instagram, Facebook, or TikTok)
2. **Grant optional permissions** if prompted (NoH8 needs access to read page content to find comments)
3. **Browse comments normally** — NoH8 automatically:
   - Detects comments in the page
   - Analyzes them locally using the ML model
   - Highlights potentially harmful comments with a rainbow indicator
4. **Click the NoH8 icon** in your toolbar to open the sidepanel dashboard and see all flagged comments in one place

### Using the Features

- **Rainbow buttons** appear next to analyzed comments — click to see detailed analysis
- **Sidepanel dashboard** shows all flagged comments with filtering by issue type
- **"Report on [Platform]"** opens the platform's official reporting flow
- **Draft review** (when available) warns you before posting potentially harmful comments

### Model Management

In Settings, you can:

- Switch between models (Toxic-BERT, multilingual sentiment, SST-2, Twitter RoBERTa)
- Download models for offline use
- Refresh or delete models to manage storage
- If no model is downloaded, a fast heuristic analyzer provides basic coverage

## How Reporting Works

### What NoH8 Does

NoH8 helps you **document and report** hate speech you encounter on social media. Here's how the reporting flow works:

1. **Detection**: NoH8 analyzes comments locally using on-device ML models
2. **Flagging**: Potentially harmful comments are highlighted with rainbow indicators
3. **Review**: Click the rainbow button to see detailed analysis (toxicity score, specific issues detected)
4. **Report**: Use the "Report on [Platform]" button to open the platform's official reporting interface

### Report Entry Points

Each platform has different reporting mechanisms. NoH8 opens the **official platform reporting flow**:

- **YouTube**: Opens YouTube's comment reporting interface
- **Instagram**: Opens Instagram's comment reporting flow
- **Facebook**: Opens Facebook's comment reporting interface
- **TikTok**: Opens TikTok's comment reporting flow

> **Note:** At this time, no major platform provides a stable, public comment-level deep-link for reporting. NoH8 directs you to the platform's standard reporting entry point. If platforms add comment-specific report links in the future, NoH8 will be updated to use them.

### Evidence Collection

Before navigating to the platform's report flow, NoH8:

- Copies a **text snippet of the flagged comment** to your clipboard
- This gives you evidence to paste into the platform's reporting form
- The snippet includes the comment text and platform context

### Privacy & Data Handling

- **No data is sent to NoH8 servers** — all analysis happens on your device
- **NoH8 does not submit reports on your behalf** — it opens the platform's reporting UI for you to complete
- **Clipboard access is local-only** — the evidence snippet stays on your machine
- You control what to include in your report

## Known Limitations

### Selector Drift (L1)

Social media platforms frequently update their DOM structure and CSS class names. NoH8 uses specific selectors to find comments, and these can break when platforms change their layout.

**What this means for you:**

- If comments stop being detected on a platform, it may be due to selector drift
- NoH8 includes **secondary selectors** that attempt to recover when primary selectors fail
- The extension logs drift warnings to the console (visible in developer tools)
- Platform adapters are updated as selectors are discovered

**Workaround:** If a platform stops working, check for extension updates. The maintainers monitor platform changes and update selectors when possible.

### Heuristic Fallback Badge (M16)

When NoH8's ML model is not downloaded or fails to load, it falls back to a **deterministic keyword-based heuristic analyzer**.

**What the badge means:**

- Comments analyzed with the heuristic show a special badge indicating they were not processed by the ML model
- Heuristic analysis is less nuanced than ML-based analysis
- It may produce more false positives or miss subtle hate speech
- The badge reminds you that these results are approximate

**When fallback activates:**

- Model hasn't been downloaded yet
- Model download failed
- Model loading encountered an error
- You can download models from the Settings page for full ML analysis

### Model Catalog Sizes

NoH8 offers several ML models with different sizes and capabilities:

| Model | Purpose | Approximate Size | Notes |
| --- | --- | --- | --- |
| Toxic-BERT | Hate speech detection | ~400 MB | Default model, best for toxicity |
| Multilingual Sentiment | Sentiment analysis | ~250 MB | Works across multiple languages |
| SST-2 | Binary sentiment | ~250 MB | Positive/negative classification |
| Twitter RoBERTa | Twitter-trained sentiment | ~500 MB | Optimized for social media text |

**Considerations:**

- Larger models provide more accurate analysis but take longer to download and use more storage
- Models are downloaded once and cached locally
- You can switch models in Settings based on your needs
- Only download models you need to save space

### Platform Support Limitations

- **TikTok reply threads**: Nested reply context extraction is best-effort on TikTok due to DOM complexity
- **Composer discovery**: Draft review may not survive all SPA navigations on all platforms
- **Report deep-links**: No platforms currently support stable comment-level report URLs (see "How Reporting Works" above)

## Privacy

NoH8 is privacy-first and runs **100% on-device**. Nothing leaves your browser.

- **Inference** runs locally in an offscreen document via `@xenova/transformers` (ONNX WebAssembly/WebGPU). No comment text, analysis result, or user data is sent to any server.
- The **only** network use is downloading ML models from the Hugging Face Hub into `chrome.storage.local`, on the user's behalf and only when the user opts in from the model manager.
- **No telemetry, no analytics, no crash reporting, no remote configuration.**
- `chrome.storage.sync` is used only for user preferences (enabled platforms, draft-review toggle, calibration thresholds). Flagged-comment and model-state data lives in `chrome.storage.local` and never leaves the browser.
- No third-party scripts, no tracking, no ads.

When filling out a store's privacy questionnaire, mark data collection as **no** for browsing history, cookies, and personal data; mark data use as **no** for data sharing with third parties; and describe model downloads as the sole network activity. See `docs/LAUNCH_CHECKLIST.md` for the full disclosure text.

## Support & Contributing

### Getting Help

- Check this README for usage instructions
- Review `docs/ARCHITECTURE.md` for technical details
- Open an issue on GitHub for bugs or feature requests

### Privacy Promise

NoH8 is built on a simple principle: **your data stays yours**.

- All inference runs locally in your browser
- No comment text, analysis results, or personal data leaves your device
- The only network activity is downloading ML models from Hugging Face (when you opt in)
- No telemetry, analytics, or tracking of any kind

## Implementation Plan

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the full phased roadmap.

## License

MIT
