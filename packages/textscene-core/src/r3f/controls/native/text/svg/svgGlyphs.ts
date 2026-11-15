/**
 * The SVG glyphs of a face, as FreeType loads them with `FT_LOAD_COLOR` (`ttgload.c:2482-2532`) and
 * Godot's OT-SVG hook draws them: the glyph's document, placed at the face's FreeType size
 * (`svgGlyphPlacement.ts`) and drawn by the browser (`browserSvgPicture.ts`). The draw is async: a
 * glyph draws nothing until its bitmap lands, and each landing tells the subscribers to repaint.
 */
import { recentlyRead } from '../../../../../utils/recentlyRead';
import { createExternalStore, type ExternalStore } from '../../../../hooks/createExternalStore';
import type { ColourBitmap } from '../colour/colourBitmap';
import {
  freeTypeTrueTypeSize,
  ftMulFix,
  getFontOutlineScale,
  pixCeil,
  pixFloor,
  pixRound,
} from '../fontMetrics';
import { fontWork } from '../settledChannel';
import { glyphMetricsReader } from '../sfntGlyphMetrics';
import { parseSfntScalars, readHeadIsPpemRounded, type SfntFile } from '../sfntTables';
import type { StrikeSize } from '../strike/strikeSize';
import { browserSvgPictureDrawer, type SvgPicture, type SvgPictureDrawer } from './browserSvgPicture';
import { svgGlyphDocumentReader, type Embox, type SvgGlyphDocumentReader } from './svgGlyphDocument';
import { svgGlyphPlacement, type SvgGlyphPlacement, type SvgGlyphSize } from './svgGlyphPlacement';
import { readSvgTable, svgDocumentOf, type GzipInflate, type SvgTable } from './svgTable';

/** The FreeType size a face loads its SVG glyphs at: its size metrics, and `x_scale` in 16.16 for the advance. */
export interface SvgLoadSize extends SvgGlyphSize {
  readonly xScale: number;
}

/**
 * The colour bitmap of a glyph at the glyph origin: undefined for a glyph with no document, which
 * loads its outline instead, and null where the glyph draws nothing, for now or for good.
 */
export type SvgGlyphReader = (glyph: number) => ColourBitmap | null | undefined;

export interface SvgGlyphs {
  /** The FreeType size of the scalable face at `fontSizePx`. */
  sizeAt(fontSizePx: number): SvgLoadSize;
  /** The reader of each glyph's SVG form at `size`. A read of a glyph not yet drawn starts its draw. */
  readerAt(size: SvgLoadSize): SvgGlyphReader;
  /** Calls `listener` each time a glyph's bitmap lands, until the returned call unsubscribes. */
  subscribe(listener: () => void): () => void;
  /** A count that grows with each bitmap that lands, so a painter knows its raster is stale. */
  readonly version: number;
}

/**
 * The SVG glyphs of this many sizes of one face are kept: more than a scene draws at once, as a size
 * that drops out draws again on its next read, blank until it lands.
 */
const MAX_KEPT_SIZES = 64;
/** A size and glyph lands with a repaint only once, so sizes that drop out of a full cache cannot repaint without end. */
const MAX_LANDED_KEYS = 4096;

/** The SVG glyphs of `sfnt`, or null for a face whose `SVG ` table FreeType does not load. */
export async function svgGlyphsOf(
  sfnt: SfntFile,
  givenDrawer?: SvgPictureDrawer | null
): Promise<SvgGlyphs | null> {
  const table = readSvgTable(sfnt);
  const scalars = parseSfntScalars(sfnt);
  if (!table || !scalars) return null;
  const drawer = givenDrawer === undefined ? browserSvgPictureDrawer() : givenDrawer;
  const { gunzipSync } = await import('three/addons/libs/fflate.module.js');
  const inflate: GzipInflate = (stream) => gunzipSync(stream);
  const pictureOf = glyphPictureReader(table, inflate, svgGlyphDocumentReader(), scalars.unitsPerEm, drawer);
  const advanceOf = glyphMetricsReader(sfnt);
  const drawnAt = recentlyRead<string, Map<number, ColourBitmap | null | undefined>>(MAX_KEPT_SIZES);
  const landings = batchedLandings();
  /** Written only by the draws as they land. Cleared when full, which lets each key repaint once more. */
  const landedKeys = new Set<string>();
  const land = (
    key: string,
    drawn: Map<number, ColourBitmap | null | undefined>,
    glyph: number,
    bitmap: ColourBitmap | null
  ) => {
    drawn.set(glyph, bitmap);
    if (!bitmap || landedKeys.has(`${key}#${glyph}`)) return;
    if (landedKeys.size >= MAX_LANDED_KEYS) landedKeys.clear();
    landedKeys.add(`${key}#${glyph}`);
    landings.land();
  };
  return {
    sizeAt: scalableSizeReader(sfnt, scalars.unitsPerEm, scalars.ascent, -scalars.descent),
    readerAt: (size) => {
      const key = sizeKey(size);
      const drawn = drawnAt(key, () => new Map());
      return (glyph) => {
        if (drawn.has(glyph)) return drawn.get(glyph);
        const picture = pictureOf(glyph);
        drawn.set(glyph, picture === undefined ? undefined : null);
        if (!picture) return picture;
        const horiAdvance26_6 = ftMulFix(advanceOf(glyph, 0).horizontal.advance, size.xScale);
        // Counted as font work, so a capture waits for the glyph to land.
        const endWork = fontWork.begin();
        void drawnBitmap(picture, size, horiAdvance26_6)
          .then((bitmap) => land(key, drawn, glyph, bitmap))
          .finally(endWork);
        return null;
      };
    },
    subscribe: landings.subscribe,
    get version() {
      return landings.get();
    },
  };
}

/**
 * The count of bitmaps that have landed, told to the subscribers once per microtask: a label of
 * many emoji repaints once for the glyphs that land together, not once for each.
 */
function batchedLandings(): Pick<ExternalStore<number>, 'get' | 'subscribe'> & { land(): void } {
  const store = createExternalStore(0);
  /** Written only by `land`, and cleared by the microtask that tells the subscribers. */
  let untold = 0;
  return {
    get: store.get,
    subscribe: store.subscribe,
    land: () => {
      if (untold++ > 0) return;
      queueMicrotask(() => {
        const count = store.get() + untold;
        untold = 0;
        store.set(count);
      });
    },
  };
}

/**
 * The picture of each glyph's document, parsed once for every size: undefined for a glyph with no
 * document, and null where the browser draws nothing or no browser is there to draw.
 */
function glyphPictureReader(
  table: SvgTable,
  inflate: GzipInflate,
  documentOf: SvgGlyphDocumentReader,
  unitsPerEm: number,
  drawer: SvgPictureDrawer | null
): (glyph: number) => GlyphPicture | null | undefined {
  const pictures = new Map<number, GlyphPicture | null | undefined>();
  return (glyph) => {
    if (pictures.has(glyph)) return pictures.get(glyph);
    const document = svgDocumentOf(table, glyph, inflate);
    const glyphDocument = document && documentOf(document, glyph, unitsPerEm);
    const picture = glyphDocument && drawer?.picture(glyphDocument.xml);
    const glyphPicture = glyphDocument
      ? picture
        ? { picture, embox: glyphDocument.embox }
        : null
      : undefined;
    pictures.set(glyph, glyphPicture);
    return glyphPicture;
  };
}

/** A glyph's parsed picture, and the em box of its document. */
interface GlyphPicture {
  readonly picture: SvgPicture;
  readonly embox: Embox;
}

/** The bitmap of a glyph's picture at `size`, or null where the browser draws nothing. */
async function drawnBitmap(
  { picture, embox }: GlyphPicture,
  size: SvgGlyphSize,
  horiAdvance26_6: number
): Promise<ColourBitmap | null> {
  const placement = svgGlyphPlacement(picture.box, embox, size, horiAdvance26_6);
  if (!placement) return null;
  const texels = await picture.draw(placement);
  return texels && colourBitmapOf(placement, texels);
}

/** The size of a face drawn from `strike`, whose size metrics `FT_Select_Size` sets. */
export function strikeSvgSize({ ppem, xScale, ascender, descender }: StrikeSize): SvgLoadSize {
  return { xPpem: ppem, yPpem: ppem, ascender, descender, xScale };
}

function sizeKey({ xPpem, yPpem, ascender, descender, xScale }: SvgLoadSize): string {
  return `${xPpem}/${yPpem}/${ascender}/${descender}/${xScale}`;
}

/**
 * The size metrics of a scalable face (`ft_recompute_scaled_metrics`): the ascender up and the
 * descender down to whole pixels. A TrueType face whose `head` flags round the ppem scales by the
 * whole-pixel ppem and rounds both to the nearest pixel (`ttobjs.c:1208-1216,1255-1262`).
 */
function scalableSizeReader(
  sfnt: SfntFile,
  unitsPerEm: number,
  ascender: number,
  descender: number
): (fontSizePx: number) => SvgLoadSize {
  const isPpemRounded = sfnt.tables.has('glyf') && readHeadIsPpemRounded(sfnt);
  return (fontSizePx) => {
    const { scale: roundedScale, ppem } = freeTypeTrueTypeSize(unitsPerEm, fontSizePx, isPpemRounded);
    const scale = isPpemRounded ? roundedScale : getFontOutlineScale(unitsPerEm, fontSizePx);
    return {
      xPpem: ppem,
      yPpem: ppem,
      ascender: (isPpemRounded ? pixRound : pixCeil)(ftMulFix(ascender, scale)),
      descender: (isPpemRounded ? pixRound : pixFloor)(ftMulFix(descender, scale)),
      xScale: scale,
    };
  };
}

/**
 * The bitmap as Godot copies FreeType's BGRA into its RGBA texture (`text_server_adv.cpp:1176-1182`),
 * at the corner the placement gives.
 */
function colourBitmapOf(placement: SvgGlyphPlacement, texels: Uint8ClampedArray): ColourBitmap {
  const grid = { left: placement.left, top: -placement.top, width: placement.width, height: placement.rows };
  return { grid, texels: new Uint8Array(texels.buffer, texels.byteOffset, texels.byteLength) };
}
