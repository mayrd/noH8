import type { UiDocument } from './uiTypes';

/**
 * Rainbow motion styles (M15 — accessibility).
 *
 * Injects a single stylesheet into the host page that animates the injected
 * rainbow buttons/gradient text, and — critically — disables the animation
 * when the user has requested reduced motion via
 * `prefers-reduced-motion: reduce`. Idempotent per document.
 */

const STYLE_MARKER = 'noh8-motion-styles';

const STYLE_TEXT = `
@keyframes noh8-rainbow-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.noh8-rainbow-animated {
  background-size: 400% 400%;
  animation: noh8-rainbow-shift 6s ease infinite;
}
@media (prefers-reduced-motion: reduce) {
  .noh8-rainbow-animated { animation: none; }
}
`.trim();

/** Documents already injected into (module-level idempotency guard). */
const injected = new WeakSet<object>();

/**
 * Inject the rainbow motion stylesheet once per document. Safe to call for
 * every rendered button; later calls are no-ops.
 */
export function injectRainbowMotionStyles(doc: UiDocument): void {
  if (injected.has(doc)) return;
  injected.add(doc);

  const style = doc.createElement('style');
  style.setAttribute?.('data-noh8-styles', STYLE_MARKER);
  style.textContent = STYLE_TEXT;
  doc.body.appendChild?.(style);
}
