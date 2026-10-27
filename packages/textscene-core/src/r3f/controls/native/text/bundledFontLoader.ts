/**
 * Registers the bundled Open Sans font as a `FontFace` and hands out its canvas metrics, through the
 * door and the settled channel of `sceneFontLoader.ts`. Only the lazy `Label3D` glyph chunk imports
 * it, so the base64 font bytes stay out of the initial bundle.
 */
import { createOpenSansCanvasFontMetrics } from './openSansCanvasFontMetrics';
import { OPEN_SANS_WOFF2_BASE64 } from './openSansFontBytes';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import { notifySceneFontSettled, registerFontFace } from './sceneFontLoader';
import * as logger from '../../../../logger';
import { decodeBase64Bytes } from '../../../../godot/variant/packedBytes';

/** Fixed, unlike a scene font's counter-suffixed name: there is exactly one bundled font and it is registered exactly once. */
const BUNDLED_FAMILY = 'tscn-bundled-open-sans-semibold';

/** Written only by `peekBundledCanvasFontMetrics`, once, and never cleared: a failed registration is not retried. */
let bundledRegistration: Promise<void> | undefined;
/** Undefined until `document.fonts.add` resolves: `fillText` with an unregistered family paints a system font without failing. */
let bundledMetrics: CanvasFontMetrics | undefined;

function decodeBundledWoff2(): ArrayBuffer {
  return decodeBase64Bytes(OPEN_SANS_WOFF2_BASE64).buffer;
}

async function registerBundledFont(): Promise<void> {
  try {
    const doc = await registerFontFace(BUNDLED_FAMILY, decodeBundledWoff2);
    if (!doc) {
      logger.warn(
        '[BundledFont] No FontFace/document.fonts in this environment; the bundled canvas-rasterised font is unavailable.'
      );
      return;
    }
    bundledMetrics = createOpenSansCanvasFontMetrics(BUNDLED_FAMILY);
  } catch (err: unknown) {
    logger.warn(
      `[BundledFont] Failed to register the bundled font (${err instanceof Error ? err.message : String(err)}).`
    );
  } finally {
    // Notifies on any settle, as the scene arm does, so a consumer that peeked re-renders once.
    notifySceneFontSettled();
  }
}

/** Synchronous answer for a solve/paint pass: the canvas metrics once registration resolved, `undefined` before that. Kicks the registration off on first call. */
export function peekBundledCanvasFontMetrics(): CanvasFontMetrics | undefined {
  bundledRegistration ??= registerBundledFont();
  return bundledMetrics;
}
