/**
 * The SVG glyphs of a face, as FreeType loads them with `FT_LOAD_COLOR` (`ttgload.c:2482-2532`) and
 * Godot's OT-SVG hook draws them (`svgGlyphRaster.ts`): the glyph's document, drawn at the face's
 * FreeType size into the BGRA bitmap Godot copies into its glyph texture.
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
import { svgGlyphDocumentReader } from './svgGlyphDocument';
import type { SvgGlyphSize } from './svgGlyphPlacement';
import { drawSvgGlyph } from './svgGlyphRaster';
import { readSvgTable, svgDocumentOf, type GzipInflate } from './svgTable';
import type { PictureDecoders } from './thorvg/pictureLoader';

/** The FreeType size a face loads its SVG glyphs at: its size metrics, and `x_scale` in 16.16 for the advance. */
export interface SvgLoadSize extends SvgGlyphSize {
  readonly xScale: number;
}

/**
 * The colour bitmap of a glyph at the glyph origin: undefined for a glyph with no document, which
 * loads its outline instead, and null where Godot's hook draws nothing.
 */
export type SvgGlyphReader = (glyph: number) => ColourBitmap | null | undefined;

export interface SvgGlyphs {
  /** The FreeType size of the scalable face at `fontSizePx`. */
  sizeAt(fontSizePx: number): SvgLoadSize;
  /** The reader of each glyph's SVG form at `size`. */
  readerAt(size: SvgLoadSize): SvgGlyphReader;
}

/** A font size animation passes through many sizes, so the SVG glyphs of this many sizes of one face are kept. */
const MAX_KEPT_SIZES = 8;
/** `TT_HEAD_FLAG_INTEGER_PPEM` of `head`'s flags, at offset 16: the face scales by the whole-pixel ppem. */
const HEAD_FLAGS_OFFSET = 16;
const HEAD_FLAG_PPEM_ROUNDED = 0x8;

/** The SVG glyphs of `sfnt`, or null for a face whose `SVG ` table FreeType does not load. */
export async function svgGlyphsOf(sfnt: SfntFile): Promise<SvgGlyphs | null> {
  const table = readSvgTable(sfnt);
  const scalars = parseSfntScalars(sfnt);
  if (!table || !scalars) return null;
  const { gunzipSync, unzlibSync } = await import('three/addons/libs/fflate.module.js');
  const inflate: GzipInflate = (stream) => gunzipSync(stream);
  const decoders: PictureDecoders = { inflate: (stream) => unzlibSync(stream) };
  const documentOf = svgGlyphDocumentReader();
  const advanceOf = glyphMetricsReader(sfnt);
  const { unitsPerEm } = scalars;
  const sizeAt = scalableSizeReader(sfnt, unitsPerEm, scalars.ascent, -scalars.descent);
  const drawnAt = recentlyRead<string, Map<number, ColourBitmap | null | undefined>>(MAX_KEPT_SIZES);
  return {
    sizeAt,
    readerAt: (size) => {
      const drawn = drawnAt(sizeKey(size), () => new Map());
      return (glyph) => {
        if (drawn.has(glyph)) return drawn.get(glyph);
        const document = svgDocumentOf(table, glyph, inflate);
        const horiAdvance26_6 = ftMulFix(advanceOf(glyph, 0).horizontal.advance, size.xScale);
        const bitmap = document
          ? colourBitmapOf(
              drawSvgGlyph(documentOf(document, glyph, unitsPerEm), size, horiAdvance26_6, decoders)
            )
          : undefined;
        drawn.set(glyph, bitmap);
        return bitmap;
      };
    },
  };
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
 * The bitmap as Godot copies FreeType's BGRA into its RGBA texture (`text_server_adv.cpp:1176-1182`).
 * ThorVG's straight ARGB words lie in memory as B, G, R and A.
 */
function colourBitmapOf(bitmap: ReturnType<typeof drawSvgGlyph>): ColourBitmap | null {
  if (!bitmap) return null;
  const { placement, pixels } = bitmap;
  const texels = new Uint8Array(pixels.length * 4);
  for (let i = 0; i < pixels.length; i++) {
    const word = pixels[i]!;
    texels[i * 4] = (word >>> 16) & 0xff;
    texels[i * 4 + 1] = (word >>> 8) & 0xff;
    texels[i * 4 + 2] = word & 0xff;
    texels[i * 4 + 3] = word >>> 24;
  }
  const grid = { left: placement.left, top: -placement.top, width: placement.width, height: placement.rows };
  return { grid, texels };
}
