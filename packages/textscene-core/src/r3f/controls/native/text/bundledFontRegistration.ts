/**
 * Registers the bundled Open Sans SemiBold with `document.fonts` and hands
 * out its `'canvas'`-kind metrics — the gate that makes
 * `openSansCanvasFontMetrics.ts` safe to paint with.
 *
 * `ctx.fillText` with an unregistered family does not fail: it silently
 * rasterises a SYSTEM font, whose pixels are frame-stable enough for a
 * visual harness to settle on and capture. The scene-font path is
 * structurally immune because canvas-kind metrics only exist once its
 * `FontFace` resolves (`sceneFontLoader.ts`); the bundled font gets the same
 * property here — `undefined` until `document.fonts.add` has happened.
 *
 * The same peek/resolve pair `sceneFontLoader.ts` establishes:
 * `peekBundledCanvasFontMetrics` always answers synchronously (`undefined`
 * while the registration is in flight or failed) and kicks the load off once;
 * `resolveBundledCanvasFontMetrics` is the same work as an awaitable promise.
 * No second settled-listener registry lives here: a consumer that needs a
 * re-render on arrival awaits `resolve` (`sceneFontLoader.ts`'s
 * `onSceneFontMetricsSettled` fires for scene fonts only — its notifier is
 * private to that module).
 *
 * Bytes, not a URL: the webview CSP (`default-src 'none'`, no `font-src`)
 * blocks fetching even a `data:` URL, so registration goes through
 * `new FontFace(name, arrayBuffer)` — `sceneFontLoader.ts`'s validated door.
 */
import { OPEN_SANS_WOFF2_BASE64 } from './openSansFontBytes';
import { createOpenSansCanvasFontMetrics } from './openSansCanvasFontMetrics';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import * as logger from '../../../../logger';

/** Fixed, unlike a scene font's counter-suffixed name: there is exactly one bundled font and this module registers it exactly once. */
const BUNDLED_FAMILY = 'tscn-bundled-open-sans-semibold';

let registration: Promise<CanvasFontMetrics | undefined> | undefined;
let settled: CanvasFontMetrics | undefined;

function decodeWoff2(): ArrayBuffer {
  const binary = atob(OPEN_SANS_WOFF2_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function register(): Promise<CanvasFontMetrics | undefined> {
  const { FontFace: FontFaceCtor, document: doc } = globalThis as { FontFace?: typeof FontFace; document?: Document };
  if (!FontFaceCtor || !doc?.fonts) {
    logger.warn('[BundledFont] No FontFace/document.fonts in this environment; the bundled canvas-rasterised font is unavailable.');
    return undefined;
  }
  try {
    const face = new FontFaceCtor(BUNDLED_FAMILY, decodeWoff2());
    await face.load();
    doc.fonts.add(face);
    settled = createOpenSansCanvasFontMetrics(BUNDLED_FAMILY);
    return settled;
  } catch (err: unknown) {
    logger.warn(`[BundledFont] Failed to register the bundled font (${err instanceof Error ? err.message : String(err)}).`);
    return undefined;
  }
}

/** Registers the bundled font once, resolving to its canvas metrics — or `undefined` if this environment or the bytes cannot. Never throws. */
export function resolveBundledCanvasFontMetrics(): Promise<CanvasFontMetrics | undefined> {
  registration ??= register();
  return registration;
}

/** Synchronous answer for a solve/paint pass: the canvas metrics once registration resolved, `undefined` before that. Kicks the registration off on first call. */
export function peekBundledCanvasFontMetrics(): CanvasFontMetrics | undefined {
  if (!settled) void resolveBundledCanvasFontMetrics();
  return settled;
}
