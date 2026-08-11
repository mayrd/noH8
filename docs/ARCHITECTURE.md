# NoH8 Architecture

> High-level overview of NoH8's runtime architecture, data flow, entry points,
> and module responsibilities. Companion to `../AGENTS.md`.

## 1. Runtime Model

NoH8 is a **Chrome/Firefox browser extension (Manifest V3)** that runs entirely
on-device. It spreads across several browser *contexts* that exchange structured
messages over `chrome.runtime`:

| Context | Entry point | Role |
| --- | --- | --- |
| Content script | `src/content/index.ts` | Injected into social pages; discovers comments in the DOM and renders the NoH8 UI. |
| Background service worker | `src/background/serviceWorker.ts` | Runs one-time setup, ensures the offscreen document exists, and relays messages to it. |
| Offscreen document | `src/offscreen/index.ts` | Headless page hosting the heavy Transformers.js (`@xenova/transformers`) ONNX pipeline. |
| Settings UI | `src/settings/main.tsx`, `SettingsPage.tsx`, popup | Lives in `settings.html` / `popup.html`; toggles platforms, manages model downloads, reviews drafts. |

Shared contracts: data shapes in `src/shared/types.ts`; the messaging wire
protocol in `src/shared/messages.ts`; platform identities/URLs in
`src/settings/types.ts` and `src/content/platformConfig.ts`.

## 2. End-to-End Data Flow

```mermaid
flowchart TB
    subgraph Social["Social Page DOM"]
        DOM[("Page DOM")]
    end

    subgraph Content["Content Script (src/content)"]
        IDX["index.ts<br/>bootstrap"]
        REG["adapters/registry.ts<br/>import.meta.glob"]
        ADP["Platform Adapters<br/>youtube / instagram / facebook / tiktok"]
        SEL["adapters/selectorStrategy.ts"]
        UI["ui/commentUi.ts"]
        INF["analysis/inferenceClient.ts"]
    end

    subgraph SW["Background Service Worker (src/background)"]
        SETUP["setup.ts<br/>runExtensionSetup"]
        RELAY["handleBackgroundMessage"]
    end

    subgraph Off["Offscreen Document (src/offscreen)"]
        INFER["inference.ts<br/>handleOffscreenRequest"]
        MODEL["modelCatalog.ts"]
        HEUR["../content/analysis/sentimentAnalyzer.ts<br/>heuristic fallback"]
    end

    subgraph Settings["Settings UI (src/settings)"]
        SSTORE["settingsStore.ts<br/>chrome.storage.sync"]
        MSTORE["modelStore.ts<br/>chrome.storage.local"]
        UI2["SettingsPage / ModelManager / popup"]
    end

    IDX --> REG --> ADP --> SEL --> DOM
    SEL -->|"CommentData[]"| ADP
    ADP --> UI
    INF --> UI
    SEL --> INF -->|"requestAnalyze"| RELAY
    RELAY -->|"relayed: true"| INFER
    INFER --> MODEL
    INFER -. "on failure" .-> HEUR
    INFER -->|"CommentAnalysis"| RELAY --> INF --> UI

    UI2 --> SSTORE
    UI2 -->|"download / delete / refresh model"| MSTORE --> RELAY
    SETUP -->|"create offscreen doc + seed storage"| Off
    SETUP --> SSTORE
---

## 3. Module Responsibilities

### Content script layer
- **`src/content/index.ts`** — boots all enabled platform adapters after
  hydrating the settings store; wires each discovered comment to inference and
  renders controls; renders draft-review buttons on comment textareas.
- **`src/content/platformConfig.ts`** — the single source of per-platform host
  match patterns used to scope the manifest and runtime permissions.
- **`src/content/adapters/`** — one `*Adapter.ts` per platform extending
  `BaseAdapter`. They (a) extract `CommentData` from containers, (b) expose an
  anchor/textarea selector for the rainbow buttons, and (c) `observe()` the DOM
  via a MutationObserver. `selectorStrategy.ts` provides the shared,
  DOM-agnostic primary/secondary container-selection helper.
- **`src/content/analysis/`** — `inferenceClient.ts` is the content-side analysis
  entry point; `sentimentAnalyzer.ts` is the deterministic keyword fallback.
- **`src/content/ui/`** — `commentUi.ts` renders the inline buttons/modals;
  `reportHelper.ts` builds the per-platform "Report" destinations.

### Background layer (`src/background/`)
- **`serviceWorker.ts`** — listens for the four message types and registers
  install/startup hooks.
- **`setup.ts`** — creates the offscreen document, seeds default model settings
  in `chrome.storage.local`, and relays client messages by stamping them
  `relayed: true` so only the offscreen pipeline processes them.

### Offscreen layer (`src/offscreen/`)
- **`inference.ts`** — owns `@xenova/transformers`; singleton pipelines per model;
  `analyzeComment` falls back to the heuristic on any model failure.
- **`modelCatalog.ts`** — the curated model catalogue + output→`CommentAnalysis`
  mapper.
- **`client.ts`** — the symmetric send-helper used by content/settings to reach
  the offscreen pipeline (through the service worker).

### Settings layer (`src/settings/`)
- **`settingsStore.ts`** (→ `chrome.storage.sync`) — platform enables + the
  "review own comment drafts" toggle, plus permission requests.
- **`modelStore.ts`** (→ `chrome.storage.local`) — selected/downloaded models +
  per-model status; synced across contexts via `chrome.storage.onChanged`.
- **React UI** — `SettingsPage` / `ModelManager` / popup for both concerns.

## 4. Storage & Permissions

- Settings (`chrome.storage.sync`): enabled platforms + review-drafts flag.
- Models (`chrome.storage.local`): selected/downloaded models, status map — shared
  across all contexts because the offscreen pipeline writes to the same area.
- Permissions: social origins are declared in `host_permissions` (required for
  content-script injection); `src/permissions/permissions.ts` checks/requests
  access at runtime.
- Network scope: only Transformers.js model downloads from the Hugging Face Hub
  (and CDN mirrors listed in `vite.config.ts`). Zero user data ever leaves the
  browser.

## 5. Extending the System

- **Add a platform:** add `content/adapters/<platform>Adapter.ts`, register its
  URL patterns in `platformConfig.ts`, add the `Platform` union member in
  `settings/types.ts` (and mirror it in `shared/types.ts` / `reportHelper.ts`),
  then add a matching `<platform>Adapter.test.ts` mirroring the existing suites
  and the Firefox-manifest expectations.
- **Add a model:** extend `offscreen/modelCatalog.ts` + cover it in
  `tests/unit/modelCatalog.test.ts`.
- **Change the wire protocol:** update `src/shared/messages.ts` **and** both the
  service-worker relay and the offscreen listener; add/adjust `offscreenClient`
  tests.
    SSTORE -.->|"enabledPlatforms"| IDX
```