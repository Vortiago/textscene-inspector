/**
 * Turns a resolved `FontResource` into `FontMetrics`, or into the bundled default when that fails.
 * It registers a scene font through the `FontFace` door of `fontFaceDoor.ts`, and it never throws.
 */
import {
  withFallbacks,
  withVariation,
  type FaceGlyphs,
  type FontMetrics,
  type GlyphVariation,
} from './fontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { faceDescriptors } from './sceneFontFace';
import { lazyFontContainer, openFontContainer } from './fontContainer';
import { sfntHasGlyph } from './sfntCmap';
import { sfntFaceGlyphs } from './sfntFaceGlyphs';
import {
  FALLBACK_MARK_TABLE_TAGS,
  parseSfntScalars,
  readAxisDefaults,
  type SfntFile,
  type SfntScalars,
} from './sfntTables';
import {
  createRuntimeFontMetrics,
  isCanvasFontMetrics,
  type CanvasFontMetrics,
  type DesignUnitWidthFn,
} from './runtimeFontMetrics';
import {
  BUNDLED_FACE,
  NO_FACE,
  fallbackChain,
  findDrawnFace,
  fontVariationEmbolden,
  fontVariationOpentype,
  fontVariationSkew,
  hasBitmap,
} from './sceneFontResolution';
import { createBitmapFontMetrics } from './bitmapFontMetrics';
import { NO_FACE_METRICS } from './noFaceMetrics';
import { perObject } from '../../../../utils/perObject';
import type { FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';
import { warnOnce } from '../../../../utils/warnOnce';
import { createSettledPeek } from './settledChannel';
import { drawLoad, peekOutlines } from './sceneFontOutlines';
import { registerFontFace } from './fontFaceDoor';
import { IS_VITEST } from '../../../../utils/isVitest';

/**
 * Design units per em for a font `sfntTables.ts` cannot parse; every measurement uses this size.
 * Large on purpose: Chromium pixel-snaps small canvas metrics. At 1000 px the box metrics of a corpus
 * `.woff2` matched its `hhea` ascent and descent exactly, and at 16 px the ascent was 12.5 units off.
 */
const SYNTHETIC_UNITS_PER_EM = 1000;

/** A counter suffix per load, so two scene fonts never collide in `document.fonts`. */
let familyCounter = 0;

/**
 * Keyed by the bytes of the resolved leaf `FontFileResource`, so nodes that share a font share one
 * load, and so does each copy `withDefaultFonts` makes of a leaf whose fallbacks take a default. Null
 * is a load that failed: the face draws the bundled default.
 */
const peekMetrics = createSettledPeek<ArrayBuffer, FontMetrics | null>();

/**
 * Written only by `peekSettledSceneFontMetrics`, once the whole chain of a font has settled. Never
 * cleared: a settled load never changes, so a solve pass composes each chain once.
 */
// eslint-disable-next-line no-restricted-syntax -- the build needs the node path for its warnings, and a perObject build takes the key alone.
const settledMetrics = new WeakMap<FontResource, FontMetrics>();

/** One `BitmapFontMetrics` for each decoded BMFont, so a layout memoised on its identity keeps its hits. */
const bitmapMetricsOf = perObject(createBitmapFontMetrics);

/** Warns once per unresolvable resource, not per call: the peek runs on every solve pass, and the failure belongs to the resource. */
function warnUnresolvable(font: FontResource, nodePath: string): void {
  warnOnce(
    font,
    'unresolvable',
    `[SceneFont] Node "${nodePath}": font resource is unresolvable (no FontFile in its fallback chain carries loadable bytes). Falling back to the bundled default font, or to the next font of its fallback chain.`
  );
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

  // The outlines place marks by HarfBuzz's fallback for a font with no `GPOS` script, and draw a
  // substituted glyph. The container decodes once for `bytes`, so preparing them costs nothing until
  // the first mark or substituted glyph.
  const glyphs = sfnt ? await faceGlyphsOf(sfnt, bytes) : undefined;
  const hasGlyph = sfnt ? sfntHasGlyph(sfnt) : () => true;
  const measureInkUnits = (ch: string) => {
    const { actualBoundingBoxLeft, actualBoundingBoxRight } = ctx.measureText(ch);
    return { left: actualBoundingBoxLeft, right: actualBoundingBoxRight };
  };
  return createRuntimeFontMetrics({
    scalars,
    measureWidthUnits,
    measureInkUnits,
    cssFontFamily: family,
    hasGlyph,
    glyphs,
  });
}

/** The glyphs of the face of `sfnt`, with the outlines and the default `GPOS` kerning of `bytes`. */
async function faceGlyphsOf(sfnt: SfntFile, bytes: ArrayBuffer): Promise<FaceGlyphs> {
  const [openOutlines, kerning] = await Promise.all([
    lazyFontContainer(bytes, FALLBACK_MARK_TABLE_TAGS),
    // The kerning of a substituted glyph only refines the advances: a chunk that fails to load
    // (offline, after a deploy) must not take the face with it.
    sfnt.tables.has('GPOS') ? import('./variation/instanceKerning').catch(() => null) : null,
  ]);
  return sfntFaceGlyphs(sfnt, openOutlines, kerning?.defaultKerningReader);
}

/** Loads a face from `bytes`. It never throws, and returns null for bytes that do not load. */
async function loadSceneFontMetrics(bytes: ArrayBuffer, nodePath: string): Promise<FontMetrics | null> {
  if (IS_VITEST) return OPEN_SANS_FONT_METRICS;
  try {
    return await loadRuntimeFont(bytes, nodePath);
  } catch (err: unknown) {
    logger.warn(
      `[SceneFont] Node "${nodePath}": failed to load scene font (${err instanceof Error ? err.message : String(err)}). Falling back to the bundled default font, or to the next font of its fallback chain.`
    );
    return null;
  }
}

/** The embolden, skew and OpenType axes of `font`, when it is a `FontVariation`. */
function fontVariation(font: FontResource): GlyphVariation {
  return {
    embolden: fontVariationEmbolden(font),
    skew: fontVariationSkew(font),
    opentype: fontVariationOpentype(font),
  };
}

/**
 * The metrics of `font` once the loads of its whole **Fallback chain** have settled, each face with
 * its `FontVariation` embolden and skew on top, and null while a load is in flight. A font that
 * cannot load, or has no bytes to load, settles at once on the bundled default, and a fallback that
 * cannot load drops out. It starts one load per face, so calling both peeks never double-loads. A
 * consumer that must not draw against the default while the real font loads reads this one.
 */
export function peekSettledSceneFontMetrics(
  font: FontResource | null | undefined,
  nodePath: string
): FontMetrics | null {
  if (!font) return OPEN_SANS_FONT_METRICS;
  const settled = settledMetrics.get(font);
  if (settled) return settled;
  const faces = peekSettledChainFaces(font, nodePath);
  if (!faces) return null;
  const [face, ...fallbacks] = faces.map(({ metrics }) => metrics);
  const metrics = withFallbacks(face!, fallbacks);
  settledMetrics.set(font, metrics);
  return metrics;
}

/** A font of a **Fallback chain**, and the settled metrics of the face it draws. Null is the bundled font. */
export interface SettledChainFace {
  readonly font: FontResource | null;
  readonly metrics: FontMetrics;
  /** Whether `metrics` are the bundled font's, standing in for a first face that is missing. */
  readonly isStandIn?: true;
}

/**
 * The settled faces of the **Fallback chain** of `font`, the drawn face first, as
 * {@link peekSettledSceneFontMetrics} composes them. Null while a load is in flight. A consumer that
 * reads more of each face than its metrics, such as its outlines, starts from this list.
 */
export function peekSettledChainFaces(
  font: FontResource | null | undefined,
  nodePath: string
): readonly SettledChainFace[] | null {
  if (!font) return [{ font: null, metrics: OPEN_SANS_FONT_METRICS }];
  const ownChain = fallbackChain(font);
  const chain = ownChain.length > 0 ? ownChain : [font];
  const faces = chain.map((entry) => peekFace(entry, nodePath));
  if (faces.includes(null)) return null;
  return chain.flatMap((entry, i): SettledChainFace[] => {
    const metrics = faces[i]!;
    if (metrics !== MISSING_FACE) return [{ font: entry, metrics }];
    // The bundled font draws in its place, with the variation the font still names.
    return i === 0
      ? [
          {
            font: entry,
            metrics: withVariation(OPEN_SANS_FONT_METRICS, fontVariation(entry)),
            isStandIn: true,
          },
        ]
      : [];
  });
}

/**
 * A face with none of its own: none resolves, or its load failed. The first face of a chain draws the
 * bundled default in its place, and a fallback drops out of its chain.
 */
const MISSING_FACE = Symbol('missing face');

/**
 * The settled metrics of the face `font` draws alone: {@link MISSING_FACE} when it has none, and null
 * while a load is in flight.
 */
function peekFace(font: FontResource, nodePath: string): FontMetrics | typeof MISSING_FACE | null {
  const face = findDrawnFace(font);
  // No failure, so no warning: Godot draws the bundled font here too.
  if (face === BUNDLED_FACE) return withVariation(OPEN_SANS_FONT_METRICS, fontVariation(font));
  if (face === NO_FACE) return NO_FACE_METRICS;
  if (!face) {
    warnUnresolvable(font, nodePath);
    return MISSING_FACE;
  }

  // A BMFont is decoded by the time its resource settles, so it needs no load of its own. Only the
  // embolden of a variation reaches it: FreeType shears and emboldens an outline, and it has none.
  if (hasBitmap(face))
    return withVariation(bitmapMetricsOf(face.bitmap), { embolden: fontVariationEmbolden(font) });

  const metrics = peekMetrics(face.bytes, () => loadSceneFontMetrics(face.bytes, nodePath));
  if (metrics === undefined) return null;
  if (metrics === null) return MISSING_FACE;
  const variation = fontVariation(font);
  // A canvas face draws every glyph from its outline. An atlas face has no contour to follow.
  const outlines = isCanvasFontMetrics(metrics) ? peekOutlines(face, drawLoad(face)) : null;
  return outlines === undefined ? null : withVariation(metrics, { ...variation, outlines });
}

/**
 * The synchronous entry for a solve pass: the bundled default while a load is in flight or failed,
 * the real metrics once it lands. Never throws.
 */
export function peekSceneFontMetrics(font: FontResource | null | undefined, nodePath: string): FontMetrics {
  return peekSettledSceneFontMetrics(font, nodePath) ?? OPEN_SANS_FONT_METRICS;
}
