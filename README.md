# NoH8 — Client-Side Hate Speech Detection Browser Extension

**Privacy-first hate speech detection directly in your browser, 100% on-device.**

NoH8 uses `Transformers.js` with ONNX WebAssembly/WebGPU to analyze social media comments (YouTube, Instagram, Facebook, TikTok) for hate speech — all locally on your machine. Zero data leaves your browser.

## Features
- ✅ 100% local ML inference — no servers, no API costs, no data leaks
- ✅ Multi-platform support: YouTube, Instagram, Facebook, TikTok
- ✅ Chrome Manifest v3 extension
- ✅ Sidepanel dashboard for batch review
- ✅ Inline DOM highlighting of flagged comments

## Tech Stack
- React 18 + TypeScript + Vite (CRXJS)
- Tailwind CSS
- Transformers.js (ONNX runtime via WebAssembly/WebGPU)
- Chrome Extension Manifest v3

## Quick Start
```bash
npm install
npm run dev    # Development mode with HMR
npm run build  # Production build in dist/
```

## Implementation Plan
See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the full phased roadmap.

## License
MIT
