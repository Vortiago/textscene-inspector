/**
 * Loads the bytes of a scene font into `FontMetrics`: it registers them through the `FontFace` door
 * of `fontFaceDoor.ts` and measures the face on a 2D canvas. It never throws.
 */
import type { FaceGlyphs } from './fontMetrics';
import { lazyFontContainer, openFontContainer } from './fontContainer';
import { registerFontFace } from './fontFaceDoor';
import {
  createRuntimeFontMetrics,
  type DesignUnitWidthFn,
  type RegisteredCanvasFontMetrics,
  type RuntimeFontMetricsInput,
} from './runtimeFontMetrics';
import { faceDescriptors } from './sceneFontFace';
import { sfntHasGlyph } from './sfntCmap';
import { sfntFaceGlyphs } from './sfntFaceGlyphs';
import { FALLBACK_MARK_TABLE_TAGS, parseSfntScalars, readAxisDefaults, type SfntFile } from './sfntTables';
import { readSfntUnderline, type SfntUnderline } from './sfntUnderline';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import * as logger from '../../../../logger';

/**
 * Design units per em for a font `sfntTables.ts` cannot parse; every measurement uses this size.
 * Large on purpose: Chromium pixel-snaps small canvas metrics. At 1000 px the box metrics of a corpus
 * `.woff2` matched its `hhea` ascent and descent exactly, and at 16 px the ascent was 12.5 units off.
 */
const SYNTHETIC_UNITS_PER_EM = 1000;

/**
 * The bundled font's underline over `SYNTHETIC_UNITS_PER_EM`, for a face whose `head` does not parse.
 * Its `post` units then have no em to scale by, and a canvas measures no underline.
 */
function bundledUnderlineInProportion(): SfntUnderline {
  const { unitsPerEm, underlinePosition = 0, underlineThickness = 0 } = OPEN_SANS_FONT_METRICS;
  const scale = SYNTHETIC_UNITS_PER_EM / unitsPerEm;
  return { underlinePosition: underlinePosition * scale, underlineThickness: underlineThickness * scale };
}

/** Written only by `loadRuntimeFont`, never cleared: a suffix per load, so two scene fonts never collide in `document.fonts`. */
let familyCounter = 0;

/**
 * Registers `bytes` as a fresh `FontFace` held at its `fvar` defaults, and builds its
 * `CanvasFontMetrics`. Ascent and descent come from the font's tables, as FreeType reads them, for a font in a container
 * `fontContainer.ts` opens, else from canvas box metrics. Throws on an invalid font, and
 * `loadSceneFontMetrics` catches and falls back.
 */
async function loadRuntimeFont(bytes: ArrayBuffer, nodePath: string): Promise<RegisteredCanvasFontMetrics> {
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
    // Unreachable in a supported browser, so the fallback warns.
    logger.warn(
      `[SceneFont] Node "${nodePath}": no 2D canvas context available; falling back to the bundled default font.`
    );
    throw new Error('CanvasRenderingContext2D unavailable');
  }

  const measurementUnitsPerEm = tableScalars?.unitsPerEm ?? SYNTHETIC_UNITS_PER_EM;
  ctx.font = `${measurementUnitsPerEm}px "${family}"`;
  const measureWidthUnits: DesignUnitWidthFn = (text) => ctx.measureText(text).width;

  let scalars: RuntimeFontMetricsInput['scalars'];
  if (sfnt && tableScalars) {
    scalars = { ...tableScalars, ...readSfntUnderline(sfnt) };
  } else {
    // Chromium's font bounding box, not `hhea`: a font that pads its box beyond `hhea` carries the
    // padded box here. Advances and kerning are canvas-measured either way.
    const boxMetrics = ctx.measureText('Hxpqjy');
    scalars = {
      unitsPerEm: SYNTHETIC_UNITS_PER_EM,
      ascent: boxMetrics.fontBoundingBoxAscent,
      descent: boxMetrics.fontBoundingBoxDescent,
      ...bundledUnderlineInProportion(),
    };
    logger.info(
      `[SceneFont] Node "${nodePath}": font bytes did not open into readable head and hhea tables; using canvas fontBoundingBoxAscent/Descent as a measured approximation for ascent/descent.`
    );
  }

  // The outlines place marks by HarfBuzz's fallback for a font with no `GPOS` script. The container
  // decodes once for `bytes`, so preparing them costs nothing until the first mark.
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
    // The kerning of shaped glyphs only refines the advances: a chunk that fails to load (offline,
    // after a deploy) must not take the face with it.
    sfnt.tables.has('GPOS') ? import('./variation/instanceKerning').catch(() => null) : null,
  ]);
  return sfntFaceGlyphs(sfnt, openOutlines, kerning?.defaultKerningReader);
}

/** Loads a face from `bytes`. It never throws, and returns null for bytes that do not load. */
export async function loadSceneFontMetrics(
  bytes: ArrayBuffer,
  nodePath: string
): Promise<RegisteredCanvasFontMetrics | null> {
  try {
    return await loadRuntimeFont(bytes, nodePath);
  } catch (err: unknown) {
    logger.warn(
      `[SceneFont] Node "${nodePath}": failed to load scene font (${err instanceof Error ? err.message : String(err)}). Falling back to the bundled default font, or to the next font of its fallback chain.`
    );
    return null;
  }
}
