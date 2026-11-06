/**
 * Registers the bundled Open Sans font as a `FontFace` and hands out its canvas metrics, through the
 * door of `fontFaceDoor.ts` and the settled channel. The base64 font bytes load as their own chunk on
 * the first peek, so they stay out of the initial bundle.
 */
import { createOpenSansCanvasFontMetrics } from './openSansCanvasFontMetrics';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import { registerFontFace } from './fontFaceDoor';
import { IS_VITEST } from '../../../../utils/isVitest';
import { createSettledPeek } from './settledChannel';
import * as logger from '../../../../logger';

/** Fixed, unlike a scene font's counter-suffixed name: there is exactly one bundled font and it is registered exactly once. */
const BUNDLED_FAMILY = 'tscn-bundled-open-sans-semibold';

/** The cache key of the bundled font, which has no resource. */
const BUNDLED = {};

/** The one registration, keyed by `BUNDLED`. Null is a registration that failed, and it is not retried. */
const peekRegistration = createSettledPeek<object, CanvasFontMetrics | null>();

/** Settles on null when the font cannot register: under vitest at once, elsewhere after a warning. */
async function registerBundledFont(): Promise<CanvasFontMetrics | null> {
  if (IS_VITEST) return null;
  try {
    const { bundledFontBytes } = await import('./bundledFontBytes');
    const doc = await registerFontFace(BUNDLED_FAMILY, bundledFontBytes);
    if (doc) return createOpenSansCanvasFontMetrics(BUNDLED_FAMILY);
    logger.warn(
      '[BundledFont] No FontFace/document.fonts in this environment; the bundled canvas-rasterised font is unavailable.'
    );
  } catch (err: unknown) {
    logger.warn(
      `[BundledFont] Failed to register the bundled font (${err instanceof Error ? err.message : String(err)}).`
    );
  }
  return null;
}

/**
 * The canvas metrics once registration resolved: undefined while it runs, null once it failed. The
 * first peek starts it. `fillText` with an unregistered family paints a system font without failing,
 * so no caller paints before this answers.
 */
export function peekBundledCanvasFontMetrics(): CanvasFontMetrics | null | undefined {
  return peekRegistration(BUNDLED, registerBundledFont);
}
