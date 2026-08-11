# AGENTS.md — NoH8 Working Manual for AI Agents

This file is the **authoritative instruction manual** for any AI coding agent (or
human developer) working in this repository. Read it before making any change.

**Project:** NoH8 — a privacy-first, 100% on-device hate-speech detection browser
extension for Chrome (Manifest V3) and Firefox. No servers, no data leaves the
browser.

---

## 1. Tech Stack & Architecture Overview

| Concern | Choice |
| --- | --- |
| Language | TypeScript (ESNext), `"type": "module"` |
| UI | React 18 + Zustand v5 (stores) + Tailwind CSS v3 |
| Build | Vite + [`@crxjs/vite-plugin`](https://crxjs.dev) (CRXJS) |
| ML/inference | [`@xenova/transformers`](https://github.com/xenova/transformers.js) (Transformers.js) via ONNX WebAssembly/WebGPU in an **offscreen document** |
| Tests | Vitest (24 files / 172 tests). jsdom only for `.tsx` component suites |
| Packaging | `scripts/package-firefox.mjs`; GitHub Actions `release.yml` |

### Architecture in one paragraph
The extension splits into four browser contexts that talk over
`chrome.runtime` messaging: **(1)** `content` scripts (inject into social pages,
observe the DOM, render the rainbow buttons), **(2)** a **background** Manifest
V3 service worker (one-time setup + message relay), **(3)** an **offscreen
document** that hosts the heavy Transformers.js pipeline, and **(4)** the
**settings UI** (popup + settings page) that manages platform toggles and the
ML model catalog. Settings persist to `chrome.storage.sync`; model state persists
to `chrome.storage.local`. See `docs/ARCHITECTURE.md` for the full data-flow
diagram and module map.

### Directory layout (source)
```
src/
├── background/    # service worker + one-time setup (creates offscreen doc, seeds storage)
├── content/
│   ├── index.ts           # content-script entry point (boots adapters)
│   ├── platformConfig.ts  # per-platform URL match patterns (manifest scope)
│   ├── adapters/          # per-platform DOM adapters + registry (import.meta.glob)
│   ├── analysis/          # inferComment client + heuristic sentiment fallback
│   └── ui/                # comment controls (buttons/modal) + report-link helpers
├── offscreen/     # Transformers.js pipeline, model catalog, message client
├── permissions/   # chrome.permissions helper for platform access
├── settings/      # React UI (popup / settings page), zustand stores, model store
├── shared/        # types.ts + messages.ts (the cross-context wire protocol)
└── index.css      # global Tailwind stylesheet
tests/             # Vitest suites mirroring src/ (unit/*.test.ts + *.test.tsx)
```

---

## 2. Code Style Constraints & Conventions

Strict, functional, and modular. Follow these or your change will be rejected.

- **Small files < 300 LOC.** Refactor anything that grows past ~300 lines into
  focused modules. Current offenders to keep an eye on: `src/content/ui/commentUi.ts`
  (~460 LOC) and `tests/unit/commentUi.test.ts` (~460 LOC).
- **Strict typing is the norm.** Give every function/parameter an explicit return
  type and never introduce implicit `any`. Prefer `unknown` over `any` when you
  cannot type a DOM/transformer boundary. (Note: `tsconfig.json` currently has
  `"strict": false` — see "Known debt" §5 — but new code must still be fully
  typed and should compile cleanly under strict settings.)
- **Functional modularity.** Prefer pure, dependency-injected functions over
  classes (except `BaseAdapter` and the concrete platform adapters, which are
  intentionally class-based). Avoid side effects inside pure modules; isolate all
  `chrome.*` and DOM access behind thin seams so tests can mock them.
- **Shared, single-source-of-truth types.** Cross-context data lives in
  `src/shared/types.ts` and the message wire protocol in `src/shared/messages.ts`.
  Do **not** redefine comment/platform/analysis shapes elsewhere; import them.
  Use the `Platform` type (`src/settings/types.ts`) instead of raw string unions.
- **Discriminated unions for messages.** All offscreen requests/responses are
  discriminated unions (`AnalyzeRequest | ModelCommandRequest`, `ok: true|false`).
  Extend the union — never branch on loose strings.
- **Naming.** Files are `camelCase.ts`; React components are `PascalCase.tsx`
  (e.g. `SettingsPage.tsx`, `ModelManager.tsx`). Adapters/classes are `PascalCase`.
- **DOM adapters are fragile.** Social-media DOMs are obfuscated and change often.
  Keep selectors centralized (per-adapter + `selectCommentContainers` in
  `selectorStrategy.ts`), never hard-code selectors in UI code, and add a unit
  test per selector strategy.
- **Comments & JSDoc.** Document *why*, not *what*. Include JSDoc blocks on
  module-level entry points. Preserve the existing header-comment style.
- **No secrets / no network data.** Everything runs on-device. Never add a
  server call, API key, or telemetry. `@xenova/transformers` downloads models
  from the Hugging Face Hub — that is the only sanctioned network use.

---

## 3. Commands

Run everything through npm from the repo root. Node 20+ (repo tested on v24).

| Task | Command |
| --- | --- |
| Install deps | `npm install` |
| Dev server (HMR) | `npm run dev` |
| Build production bundle (`dist/`) | `npm run build` |
| **Unified check** (typecheck + test + build) | `npm run check` |
| Type-check only | `npm run typecheck` (alias `npm run lint`) |
| Run the full test suite | `npm test` |
| Watch tests | `npx vitest` |
| Package Firefox build (`dist-firefox/`) | `npm run package:firefox` |
| Regenerate PNG icons | `python3 scripts/generate-icons.py` |

> **Always run `npm run check` before pushing.** It is the deterministic
> gate: TypeScript must pass, all 172 tests must pass, and the production build
> must succeed. The GitHub Actions `release.yml` test job runs the same command.
---

## 4. Strict Boundaries (do not touch without permission)

- **`dist/`, `dist-firefox/`, `releases/`, `node_modules/`, `package-lock.json`**
  — generated/derived artifacts and vendored deps. Never hand-edit or commit them.
- **`.github/workflows/release.yml`** — release/publish automation. Coordinate
  before changing how releases are tagged or published.
- **`src/content/adapters/*Adapter.ts` selector strings** — see the note above:
  these are high-risk, platform-fragile heuristics. Modify only with a clear,
  tested rationale.
- **`src/offscreen/modelCatalog.ts` & `src/offscreen/inference.ts`** — the ML
  pipeline and catalog. Changes affect model downloads, hashes, and inference;
  require explicit approval and test coverage.
- **`public/manifest.json` and `vite.config.ts` manifest wiring** — permission
  and host-match scoping. Adding origins broadens the extension's surface and
  triggers new install warnings; get sign-off first.
- **Tests that document existing behavior** — do not weaken or delete passing
  assertions to make a change fit; evolve both together.

---

## 5. Known Debt & Roadmap

- `tsconfig.json` sets `"strict": false`. **Recommended:** flip to `true` and fix
  the resulting violations in `registry.ts` (`any` in `import.meta.glob` typing),
  `permissions.ts` (`hasPermissionsApi(chromeObj: any)`), and `offscreen/inference.ts`
  (`Map<string, unknown>`, `as`-casts around the Transformers pipeline).
- `src/content/index.ts` had a structural/boot bug (draft-review code orphaned
  outside the `.then()` chain) that was repaired; keep its boot flow covered.
- Bundler warns about a >500 kB chunk (Transformers.js). Code-splitting the
  offscreen pipeline is a possible future optimization.