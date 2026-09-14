# Known Limitations

> This page documents the known limitations of NoH8 as of version 0.3.0. These are
> not bugs — they are inherent constraints of how social platforms, browser
> extensions, and on-device ML work today.

**Status:** stable. Limitations here are reviewed when new milestones ship.

---

## 1. Selector Drift (L1)

Social media platforms frequently update their DOM structure, CSS class names,
and element hierarchies. NoH8 uses specific selectors to find comments, and these
can break when platforms change their layout.

**What this means for you:**

- If comments stop being detected on a platform, it may be due to selector drift.
- NoH8 includes **secondary selectors** (`src/content/adapters/selectorStrategy.ts`)
  that attempt to recover when primary selectors fail.
- The extension logs drift warnings to the console (visible in developer tools).
- Platform adapters are updated as selectors are discovered and verified.

**How we handle it:**

- Every platform adapter ships a primary + secondary selector strategy.
- `selectorStrategy.ts` falls back to secondary selectors automatically.
- Each GA cell in the acceptance matrix has a unit test guarding selector behavior.
- `docs/PLATFORM_VERIFICATION.md` tracks live verification across Chrome and Firefox.

**Workaround:** If a platform stops working, check for extension updates.

**Tracking:** L1 (live-platform verification harness). See `IMPLEMENTATION_PLAN.md` §8.1.

---

## 2. Heuristic Fallback Badge (M16)

When NoH8's ML model is not downloaded or fails to load, it falls back to a
**deterministic keyword-based heuristic analyzer**.

**What the badge means:**

- Comments analyzed with the heuristic show a special badge indicating they were
  not processed by the ML model.
- Heuristic analysis is less nuanced than ML-based analysis.
- It may produce more false positives or miss subtle hate speech.
- The badge reminds you that these results are approximate.

**When fallback activates:**

- Model hasn't been downloaded yet
- Model download failed (network, quota, or corrupt download)
- Model loading encountered an error

**Recovery:** Click **Retry download** on the model card in Settings (M16 added
explicit failure classification and a retry path).

**Tracking:** M16 (offscreen health & model-download recovery).

---

## 3. Model Catalog Sizes

NoH8 offers several ML models with different sizes and capabilities:

| Model | Purpose | Approximate Size | Notes |
| --- | --- | --- | --- |
| Toxic-BERT | Hate speech detection | ~400 MB | Default model, best for toxicity |
| Multilingual Sentiment | Sentiment analysis | ~250 MB | Works across multiple languages |
| SST-2 | Binary sentiment | ~250 MB | Positive/negative classification |
| Twitter RoBERTa | Twitter-trained sentiment | ~500 MB | Optimized for social media text |

**Considerations:**

- Larger models provide more accurate analysis but take longer to download.
- Models are downloaded once and cached locally.
- You can switch models in Settings based on your needs.
- Only download models you need to save space.
- Model downloads are the **only network activity** NoH8 performs.

**Multi-model consensus (M17):** If you download a second model and enable consensus,
NoH8 will only flag a comment when both models agree.

**Tracking:** M16, M17. See `IMPLEMENTATION_PLAN.md` §6.5 and §6.6.

---

## 4. Platform Support Limitations

### TikTok Reply Threads

Nested reply context extraction is **best-effort on TikTok** due to DOM complexity.
Replies are still detected and analyzed, but reply-tree metadata may be incomplete.

**Tracking:** §8.5 Flow 1 matrix — TikTok reply threads are graded **B** (best-effort).

### Composer Discovery (Draft Review)

Draft review relies on each adapter's `observe()` watching for composer elements.
On some platforms, SPA re-renders may cause draft-review buttons to not survive
every navigation.

**Known gaps:** Facebook and TikTok composer discovery are graded **B** (best-effort).

**Workaround:** If the draft-review button doesn't appear, try refreshing the page.

**Tracking:** L3 (draft-review composer coverage). See `IMPLEMENTATION_PLAN.md` §8.3.

### Report Deep-Links

No platform currently offers a stable, public comment-level deep-link for reporting.
NoH8 opens the platform's standard reporting entry point and copies an evidence
snippet to your clipboard first.

**Platforms:** YouTube, Instagram, Facebook, TikTok — each opens their official
report flow in a new tab with `noopener`.

**Tracking:** L2 (reporting flow hardening). See `IMPLEMENTATION_PLAN.md` §8.2.

---

## 5. Architecture Constraints

### No Network Beyond Model Downloads

NoH8 is privacy-first and runs **100% on-device**. The only network activity is
downloading ML model weights from the Hugging Face Hub.

**What this means:** NoH8 cannot check for updates on its own — you must refresh
the extension from the store or reload the unpacked extension.

### Offscreen Document Lifecycle

The heavy ML pipeline runs in a separate **offscreen document** so it never blocks
the social media page.

**What this means:** The first analysis after install may take slightly longer.
If the offscreen document crashes, it's recreated automatically.

### Browser Storage Quotas

Models and flagged comments are stored in `chrome.storage.local`.

**What this means:** If a model download fails with a quota error, delete unused
models first. Flagged-comment history can be exported as JSON and cleared.

---

## 6. Scope Limitations

### Supported Platforms

NoH8 currently supports **YouTube, Instagram, Facebook, and TikTok**.

### Supported Languages

The default Toxic-BERT model is English-focused. The multilingual sentiment model
supports multiple languages but may be less accurate for hate-speech detection.

### Manifest V3 Constraints

NoH8 uses Chrome Manifest V3, which imposes service worker lifecycle, offscreen
document requirements, and strict CSP.

---

## 7. Reporting Issues

When filing an issue, please include:

1. **Platform** (YouTube / Instagram / Facebook / TikTok)
2. **Browser and version** (Chrome 128 / Firefox 130, etc.)
3. **What you expected**
4. **What happened**
5. **A screenshot** if relevant (blur personal data)
6. **Console output** if you see drift warnings

For selector-drift issues, mention whether you saw a `selectorStrategy` console.warn.

---

*Last updated: 2026-09-11 (v0.3.0, L5 milestone)*
