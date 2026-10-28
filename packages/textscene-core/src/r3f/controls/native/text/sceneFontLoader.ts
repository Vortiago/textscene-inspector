/**
 * Turns a resolved `FontResource` into `FontMetrics`, or into the bundled default when that fails.
 * It owns the `FontFace` door, which `bundledFontLoader.ts` shares. It is the one DOM-touching
 * module of the font pipeline, and it never throws.
 */
import { withVariation, type FontMetrics, type GlyphVariation } from './fontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { faceDescriptors } from './sceneFontFace';
import { openFontContainer } from './fontContainer';
import { parseSfntScalars, readAxisDefaults, type SfntScalars } from './sfntTables';
import {
  createRuntimeFontMetrics,
  type CanvasFontMetrics,
  type DesignUnitWidthFn,
} from './runtimeFontMetrics';
import { fontVariationEmbolden, fontVariationSkew, resolveFontFileBytes } from './sceneFontResolution';
import { endsWithoutBase } from '../../../../resources/fonts/font/defaultBaseFont';
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';
import { warnOnce } from '../../../../utils/warnOnce';
import { createSettledPeek } from './settledChannel';
import { peekGlyphOutlines } from './sceneFontOutlines';

// happy-dom has neither `FontFace` nor a 2D canvas context, so under vitest the loader skips to the
// bundled default before any DOM font API. The skip is deliberate, so it does not warn.
// `r3f/internalTextLabel.tsx` uses the same detection.
const IS_VITEST = (() => {
  const proc = (globalThis as { process?: { env?: { VITEST?: string } } }).process;
  return proc?.env?.VITEST === 'true';
})();

/**
 * Design units per em for a font `sfntTables.ts` cannot parse; every measurement uses this size.
 * Large on purpose: Chromium pixel-snaps small canvas metrics. At 1000 px the box metrics of a corpus
 * `.woff2` matched its `hhea` ascent and descent exactly, and at 16 px the ascent was 12.5 units off.
 */
const SYNTHETIC_UNITS_PER_EM = 1000;

/** A counter suffix per load, so two scene fonts never collide in `document.fonts`. */
let familyCounter = 0;

/** Keyed by the resolved leaf `FontFileResource`, so nodes that share a font share one load. */
const peekMetrics = createSettledPeek<FontFileResource, FontMetrics>();

/** Warns once per unresolvable resource, not per call: the peek runs on every solve pass, and the failure belongs to the resource. */
function warnUnresolvable(font: FontResource, nodePath: string): void {
  const reason =
    font.kind === 'system'
      ? `a SystemFont (OS family names: ${font.fontNames.join(', ') || '(none)'}) -- this previewer has no access to the user's system fonts`
      : 'no FontFile in its fallback chain carries loadable bytes';
  warnOnce(
    font,
    'unresolvable',
    `[SceneFont] Node "${nodePath}": font resource is unresolvable (${reason}). Falling back to the bundled default font.`
  );
}

/**
 * The CSP-validated door (`default-src 'none'`, no `connect-src` or `font-src`):
 * bytes in hand go to `new FontFace` and `document.fonts.add`, with no fetch of any URL, no worker,
 * eval or WASM. Resolves to `undefined` with no `FontFace`, and rejects only on bytes that are not
 * a font, so `bytes` is a thunk that does not decode where there is no door.
 */
export async function registerFontFace(
  family: string,
  bytes: () => ArrayBuffer,
  descriptors?: FontFaceDescriptors
): Promise<Document | undefined> {
  // Read lazily: a non-DOM environment answers `undefined`, and a late `document.fonts` is still seen.
  const { FontFace: FontFaceCtor, document: doc } = globalThis as {
    FontFace?: typeof FontFace;
    document?: Document;
  };
  if (!FontFaceCtor || !doc?.fonts) return undefined;
  const face = new FontFaceCtor(family, bytes(), descriptors);
  await face.load();
  doc.fonts.add(face);
  return doc;
}

/**
 * Registers `bytes` as a fresh `FontFace` held at its `fvar` defaults, and builds its
 * `CanvasFontMetrics`. Ascent and descent come from the font's tables, as FreeType reads them, for a font in a container
 * `fontContainer.ts` opens, else from canvas box metrics. Throws on an invalid font, and
 * `loadSceneFontMetrics` catches and falls back.
 */
async function loadRuntimeFont(bytes: ArrayBuffer, nodePath: string): Promise<CanvasFontMetrics> {
  const family = `tscn-scene-font-${++familyCounter}`;
  const sfnt = await openFontContainer(bytes);
  const doc = await registerFontFace(
    family,
    () => bytes,
    sfnt ? faceDescriptors(readAxisDefaults(sfnt)) : undefined
  );
  if (!doc) {
    logger.warn(
      `[SceneFont] Node "${nodePath}": no FontFace/document.fonts in this environment; falling back to the bundled default font.`
    );
    throw new Error('FontFace unavailable');
  }

  const tableScalars = sfnt && parseSfntScalars(sfnt);

  const measureCanvas = doc.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) {
    // Unreachable in a supported browser, but a real fallback that warns, unlike the `IS_VITEST`
    // skip, which never reaches this function.
    logger.warn(
      `[SceneFont] Node "${nodePath}": no 2D canvas context available; falling back to the bundled default font.`
    );
    throw new Error('CanvasRenderingContext2D unavailable');
  }

  const measurementUnitsPerEm = tableScalars?.unitsPerEm ?? SYNTHETIC_UNITS_PER_EM;
  ctx.font = `${measurementUnitsPerEm}px "${family}"`;
  const measureWidthUnits: DesignUnitWidthFn = (text) => ctx.measureText(text).width;

  let scalars: SfntScalars;
  if (tableScalars) {
    scalars = tableScalars;
  } else {
    // Chromium's font bounding box, not `hhea`: a font that pads its box beyond `hhea` carries the
    // padded box here. Advances and kerning are canvas-measured either way.
    const boxMetrics = ctx.measureText('Hxpqjy');
    scalars = {
      unitsPerEm: SYNTHETIC_UNITS_PER_EM,
      ascent: boxMetrics.fontBoundingBoxAscent,
      descent: boxMetrics.fontBoundingBoxDescent,
    };
    logger.info(
      `[SceneFont] Node "${nodePath}": font bytes did not open into readable head and hhea tables; using canvas fontBoundingBoxAscent/Descent as a measured approximation for ascent/descent.`
    );
  }

  return createRuntimeFontMetrics({ scalars, measureWidthUnits, cssFontFamily: family });
}

/** Loads the font at `bytes`. It never throws, and always returns usable `FontMetrics`. */
async function loadSceneFontMetrics(bytes: ArrayBuffer, nodePath: string): Promise<FontMetrics> {
  if (IS_VITEST) return OPEN_SANS_FONT_METRICS;
  try {
    return await loadRuntimeFont(bytes, nodePath);
  } catch (err: unknown) {
    logger.warn(
      `[SceneFont] Node "${nodePath}": failed to load scene font (${err instanceof Error ? err.message : String(err)}). Falling back to the bundled default font.`
    );
    return OPEN_SANS_FONT_METRICS;
  }
}

/** The embolden and skew of `font`, when it is a `FontVariation`. */
function fontVariation(font: FontResource): GlyphVariation {
  return { embolden: fontVariationEmbolden(font), skew: fontVariationSkew(font) };
}

/**
 * The metrics of `font` once its load has settled, with the `FontVariation` embolden and skew on
 * top, and null while a load is in flight. A font that cannot load, or has no bytes to load,
 * settles at once on the bundled default. It starts one load per font, so calling both peeks
 * never double-loads. A consumer that must not draw against the default while
 * the real font loads reads this one.
 */
export function peekSettledSceneFontMetrics(
  font: FontResource | null | undefined,
  nodePath: string
): FontMetrics | null {
  if (!font) return OPEN_SANS_FONT_METRICS;

  const resolved = resolveFontFileBytes(font);
  if (!resolved) {
    // A variation with no `base_font` over the bundled default font: no failure, so no warning.
    if (endsWithoutBase(font)) return withVariation(OPEN_SANS_FONT_METRICS, fontVariation(font));
    warnUnresolvable(font, nodePath);
    return OPEN_SANS_FONT_METRICS;
  }

  const metrics = peekMetrics(resolved.leaf, () => loadSceneFontMetrics(resolved.bytes, nodePath));
  if (!metrics) return null;
  const variation = fontVariation(font);
  const outlines = peekGlyphOutlines(font, metrics, variation);
  return outlines === undefined ? null : withVariation(metrics, { ...variation, outlines });
}

/**
 * The synchronous entry for a solve pass: the bundled default while a load is in flight or failed,
 * the real metrics once it lands. Never throws.
 */
export function peekSceneFontMetrics(font: FontResource | null | undefined, nodePath: string): FontMetrics {
  return peekSettledSceneFontMetrics(font, nodePath) ?? OPEN_SANS_FONT_METRICS;
}
