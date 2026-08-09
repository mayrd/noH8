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
