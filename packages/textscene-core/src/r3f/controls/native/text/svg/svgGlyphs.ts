/**
 * The SVG glyphs of a face, as FreeType loads them with `FT_LOAD_COLOR` (`ttgload.c:2482-2532`) and
 * Godot's OT-SVG hook draws them: the glyph's document, placed at the face's FreeType size
 * (`svgGlyphPlacement.ts`) and drawn by the browser (`browserSvgPicture.ts`). The draw is async: a
 * glyph draws nothing until its bitmap lands, and each landing tells the subscribers to repaint.
 */
import { recentlyRead } from '../../../../../utils/recentlyRead';
import type { ColourBitmap } from '../colour/colourBitmap';
import {
  freeTypeTrueTypeSize,
  ftMulFix,
  getFontOutlineScale,
  pixCeil,
  pixFloor,
  pixRound,
} from '../fontMetrics';
import { glyphMetricsReader } from '../sfntGlyphMetrics';
import { parseSfntScalars, tableBytes, type SfntFile } from '../sfntTables';
import type { StrikeSize } from '../strike/strikeSize';
import { browserSvgPictureDrawer, type SvgPictureDrawer } from './browserSvgPicture';
import { svgGlyphDocumentReader, type SvgGlyphDocument } from './svgGlyphDocument';
import { svgGlyphPlacement, type SvgGlyphPlacement, type SvgGlyphSize } from './svgGlyphPlacement';
import { readSvgTable, svgDocumentOf, type GzipInflate } from './svgTable';

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

/** A font size animation passes through many sizes, so the SVG glyphs of this many sizes of one face are kept. */
const MAX_KEPT_SIZES = 8;
/** `TT_HEAD_FLAG_INTEGER_PPEM` of `head`'s flags, at offset 16: the face scales by the whole-pixel ppem. */
const HEAD_FLAGS_OFFSET = 16;
const HEAD_FLAG_PPEM_ROUNDED = 0x8;

/** The SVG glyphs of `sfnt`, or null for a face whose `SVG ` table FreeType does not load. */
export async function svgGlyphsOf(
  sfnt: SfntFile,
  drawer: SvgPictureDrawer | null = browserSvgPictureDrawer()
): Promise<SvgGlyphs | null> {
  const table = readSvgTable(sfnt);
  const scalars = parseSfntScalars(sfnt);
  if (!table || !scalars) return null;
  const { gunzipSync } = await import('three/addons/libs/fflate.module.js');
  const inflate: GzipInflate = (stream) => gunzipSync(stream);
  const documentOf = svgGlyphDocumentReader();
  const advanceOf = glyphMetricsReader(sfnt);
  const { unitsPerEm } = scalars;
  const drawnAt = recentlyRead<string, Map<number, ColourBitmap | null | undefined>>(MAX_KEPT_SIZES);
  const listeners = new Set<() => void>();
  /** Written only by `land`, which then calls every listener. */
  let version = 0;
  const land = (
    drawn: Map<number, ColourBitmap | null | undefined>,
    glyph: number,
    bitmap: ColourBitmap | null
  ) => {
    drawn.set(glyph, bitmap);
    if (!bitmap) return;
    version++;
    for (const listener of listeners) listener();
  };
  return {
    sizeAt: scalableSizeReader(sfnt, unitsPerEm, scalars.ascent, -scalars.descent),
    readerAt: (size) => {
      const drawn = drawnAt(sizeKey(size), () => new Map());
      return (glyph) => {
        if (drawn.has(glyph)) return drawn.get(glyph);
        const document = svgDocumentOf(table, glyph, inflate);
        if (!document) {
          drawn.set(glyph, undefined);
          return undefined;
        }
        drawn.set(glyph, null);
        const horiAdvance26_6 = ftMulFix(advanceOf(glyph, 0).horizontal.advance, size.xScale);
        const glyphDocument = documentOf(document, glyph, unitsPerEm);
        void drawnBitmap(drawer, glyphDocument, size, horiAdvance26_6).then((bitmap) =>
          land(drawn, glyph, bitmap)
        );
        return null;
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get version() {
      return version;
    },
  };
}

/** The bitmap of a glyph's document, or null where the browser draws nothing or no browser is there to draw. */
async function drawnBitmap(
  drawer: SvgPictureDrawer | null,
  document: SvgGlyphDocument,
  size: SvgGlyphSize,
  horiAdvance26_6: number
): Promise<ColourBitmap | null> {
  const box = drawer?.contentBox(document.xml);
  if (!drawer || !box) return null;
  const embox = { x: document.emboxX, y: document.emboxY };
  const placement = svgGlyphPlacement(box, embox, size, horiAdvance26_6);
  if (!placement) return null;
  const texels = await drawer.draw(document.xml, box, placement);
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
  const head = tableBytes(sfnt, 'head');
  const isPpemRounded =
    sfnt.tables.has('glyf') &&
    head.length >= HEAD_FLAGS_OFFSET + 2 &&
    (((head[HEAD_FLAGS_OFFSET]! << 8) | head[HEAD_FLAGS_OFFSET + 1]!) & HEAD_FLAG_PPEM_ROUNDED) !== 0;
  return (fontSizePx) => {
    const requestScale = getFontOutlineScale(unitsPerEm, fontSizePx);
    const { scale, ppem } = freeTypeTrueTypeSize(unitsPerEm, fontSizePx, isPpemRounded);
    if (isPpemRounded) {
      return {
        xPpem: ppem,
        yPpem: ppem,
        ascender: pixRound(ftMulFix(ascender, scale)),
        descender: pixRound(ftMulFix(descender, scale)),
        xScale: scale,
      };
    }
    return {
      xPpem: ppem,
      yPpem: ppem,
      ascender: pixCeil(ftMulFix(ascender, requestScale)),
      descender: pixFloor(ftMulFix(descender, requestScale)),
      xScale: requestScale,
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
