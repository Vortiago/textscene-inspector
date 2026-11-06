/**
 * Where HarfBuzz places the marks of a cluster in a font with no `GPOS` script
 * (`hb-ot-shape-fallback.cc`, `position_around_base` and `position_mark`): each mark sits against
 * the ink of the base and of the marks before it, by its combining class: centred, or aligned left
 * or right, above or below. The port covers left-to-right clusters of one base and non-spacing
 * marks, with no ligature components, which is what a canonical decomposition gives. It works in
 * the 26.6 integers that Godot's HarfBuzz font holds (`hb-ft.cc`), because a quantised extent moves
 * a mark by a 64th of a pixel, and that flips a whole-pixel round.
 *
 * Portions ported from HarfBuzz ("Old MIT" licence).
 * Copyright (C) 2007-2026 by Behdad Esfahbod and the HarfBuzz contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import { COMBINING_CLASS_RUNS } from './combiningClasses';
import { ftMulFix, getFontOutlineScale, glyphAdvance26_6, FIXED_26_6_ONE } from './fontMetrics';
import { ORIGIN, type MarkOffset } from './markPositioning';
import { extent } from './glyphContours';
import { unscaledCffOutlines } from './sfntCff';
import { sfntGlyphIndex } from './sfntCmap';
import { unscaledGlyfOutlines } from './sfntGlyf';
import { glyphMetricsReader } from './sfntGlyphMetrics';
import type { SfntFile } from './sfntTables';

/** The combining classes the placement tells apart (`hb_unicode_combining_class_t`). */
const Class = {
  ATTACHED_BELOW_LEFT: 200,
  ATTACHED_BELOW: 202,
  ATTACHED_ABOVE: 214,
  ATTACHED_ABOVE_RIGHT: 216,
  BELOW_LEFT: 218,
  BELOW: 220,
  BELOW_RIGHT: 222,
  ABOVE_LEFT: 228,
  ABOVE: 230,
  ABOVE_RIGHT: 232,
  DOUBLE_BELOW: 233,
  DOUBLE_ABOVE: 234,
} as const;

/** Hebrew, Arabic, Thai, Lao and Tibetan classes below 200, by the class that `recategorize_combining_class` gives them. */
const RECATEGORIZED_AS: Readonly<Record<number, readonly number[]>> = {
  [Class.BELOW]: [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 29, 32, 118, 129, 132],
  [Class.ATTACHED_ABOVE]: [23],
  [Class.ABOVE_RIGHT]: [24, 107],
  [Class.ABOVE_LEFT]: [19, 25],
  [Class.ABOVE]: [26, 27, 28, 30, 31, 33, 34, 35, 36, 122, 130],
  [Class.BELOW_RIGHT]: [103],
};

const RECATEGORIZED_CLASS = new Map(
  Object.entries(RECATEGORIZED_AS).flatMap(([target, classes]) =>
    classes.map((klass) => [klass, Number(target)] as const)
  )
);

/** The ink box of a glyph as `hb_glyph_extents_t` holds it in 26.6: y up, so `height` is negative. */
interface Extents {
  xBearing: number;
  yBearing: number;
  width: number;
  height: number;
}

/** The combining class of a code point that a canonical decomposition ends in, 0 for any other. */
function combiningClassOf(codePoint: number): number {
  let low = 0;
  let high = COMBINING_CLASS_RUNS.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const [first, last, klass] = COMBINING_CLASS_RUNS[middle]!;
    if (codePoint < first) high = middle - 1;
    else if (codePoint > last) low = middle + 1;
    else return RECATEGORIZED_CLASS.get(klass) ?? klass;
  }
  return 0;
}

/** Integer division by two, which truncates toward zero as C does. */
const halved = (value: number): number => (value / 2) | 0;

function markX(base: Extents, mark: Extents, klass: number): number {
  switch (klass) {
    case Class.DOUBLE_BELOW:
    case Class.DOUBLE_ABOVE:
      return base.xBearing + base.width - halved(mark.width) - mark.xBearing;
    case Class.ATTACHED_BELOW_LEFT:
    case Class.BELOW_LEFT:
    case Class.ABOVE_LEFT:
      return base.xBearing - mark.xBearing;
    case Class.ATTACHED_ABOVE_RIGHT:
    case Class.BELOW_RIGHT:
    case Class.ABOVE_RIGHT:
      return base.xBearing + base.width - mark.width - mark.xBearing;
    default:
      return base.xBearing + halved(base.width - mark.width) - mark.xBearing;
  }
}

/** The y of a mark below `base`, which the mark then extends downwards. */
function belowY(base: Extents, mark: Extents, yGap: number): number {
  let y = base.yBearing + base.height - mark.yBearing;
  // Never shift up a "below" mark.
  if (yGap > 0 === y > 0) {
    base.height -= y;
    y = 0;
  }
  base.height += mark.height;
  return y;
}

/** The y of a mark above `base`, which the mark then extends upwards. */
function aboveY(base: Extents, mark: Extents, yGap: number): number {
  let y = base.yBearing - (mark.yBearing + mark.height);
  // Do not shift an "above" mark down too far.
  if (yGap > 0 !== y > 0) {
    const correction = halved(-y);
    base.yBearing += correction;
    base.height -= correction;
    y += correction;
  }
  base.yBearing -= mark.height;
  base.height += mark.height;
  return y;
}

function markY(base: Extents, mark: Extents, klass: number, yGap: number): number {
  switch (klass) {
    case Class.DOUBLE_BELOW:
    case Class.BELOW_LEFT:
    case Class.BELOW:
    case Class.BELOW_RIGHT:
      base.height -= yGap;
      return belowY(base, mark, yGap);
    case Class.ATTACHED_BELOW_LEFT:
    case Class.ATTACHED_BELOW:
      return belowY(base, mark, yGap);
    case Class.DOUBLE_ABOVE:
    case Class.ABOVE_LEFT:
    case Class.ABOVE:
    case Class.ABOVE_RIGHT:
      base.yBearing += yGap;
      base.height -= yGap;
      return aboveY(base, mark, yGap);
    case Class.ATTACHED_ABOVE:
    case Class.ATTACHED_ABOVE_RIGHT:
      return aboveY(base, mark, yGap);
    default:
      return 0;
  }
}

/** The ink box of a glyph in design units, as the points of its outline bound it. */
interface InkBox {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

/** The ink box of each glyph, or null for a glyph with no outline to read. */
function inkBoxReader(
  sfnt: SfntFile
): { unitsPerEm: number; inkBoxOf: (glyph: number) => InkBox | null } | null {
  const outlines = unscaledGlyfOutlines(sfnt, null) ?? unscaledCffOutlines(sfnt);
  if (!outlines) return null;
  const kept = new Map<number, InkBox | null>();
  const read = (glyph: number): InkBox | null => {
    const outline = outlines.unscaledGlyph(glyph);
    if (!outline) return null;
    if (outline.x.length === 0) return { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
    const [xMin, xMax] = extent(outline.x);
    const [yMin, yMax] = extent(outline.y);
    return { xMin, xMax, yMin, yMax };
  };
  return {
    unitsPerEm: outlines.unitsPerEm,
    // The box is in design units, so every size shares it.
    inkBoxOf: (glyph) => {
      let box = kept.get(glyph);
      if (box === undefined) kept.set(glyph, (box = read(glyph)));
      return box;
    },
  };
}

/** Where each mark of a cluster sits against the base's origin in px, y up, at `fontSizePx`. */
export type SizedClusterOffsets = (cluster: readonly string[], fontSizePx: number) => readonly MarkOffset[];

/**
 * The reader of a font with no `GPOS` script, or null for a font whose outlines, `cmap` or metrics
 * `sfnt` lacks. `sfnt` holds `glyf` or `CFF `, `hmtx`, `cmap` and `head`.
 */
export function fallbackMarkReader(sfnt: SfntFile): SizedClusterOffsets | null {
  const glyphIndexOf = sfntGlyphIndex(sfnt);
  const reader = inkBoxReader(sfnt);
  if (!glyphIndexOf || !reader) return null;
  const { unitsPerEm, inkBoxOf } = reader;
  const metricsOf = glyphMetricsReader(sfnt);

  return (cluster, fontSizePx) => {
    const xScale = getFontOutlineScale(unitsPerEm, fontSizePx);
    const scaled = (units: number) => ftMulFix(units, xScale);
    const extentsOf = (box: InkBox): Extents => ({
      xBearing: scaled(box.xMin),
      yBearing: scaled(box.yMax),
      width: scaled(box.xMax) - scaled(box.xMin),
      height: scaled(box.yMin) - scaled(box.yMax),
    });
    // The font scale `hb_ft_font_changed` sets: the em in 26.6.
    const yGap = (ftMulFix(unitsPerEm, xScale) / 16) | 0;
    const toPx = ({ x, y }: MarkOffset): MarkOffset => ({ x: x / FIXED_26_6_ONE, y: y / FIXED_26_6_ONE });

    const glyphs = cluster.map((ch) => glyphIndexOf(ch.codePointAt(0)!));
    const baseInk = inkBoxOf(glyphs[0]!);
    if (!baseInk) return cluster.map(() => ORIGIN);
    // The horizontal advance, not the ink, bounds the base (harfbuzz#1532): a glyph with no ink has one too.
    const advanceUnits = metricsOf(glyphs[0]!, 0).horizontal.advance;
    const base: Extents = {
      ...extentsOf(baseInk),
      xBearing: 0,
      width: glyphAdvance26_6(advanceUnits, unitsPerEm, fontSizePx),
    };
    let reference = base;
    let lastClass = 255;
    const offsets: MarkOffset[] = [ORIGIN];
    for (let i = 1; i < cluster.length; i++) {
      const klass = combiningClassOf(cluster[i]!.codePointAt(0)!);
      const markInk = klass === 0 ? null : inkBoxOf(glyphs[i]!);
      if (!markInk) {
        offsets.push(ORIGIN);
        continue;
      }
      // A mark of a new class measures from the base again, one of the same class from the marks before it.
      if (klass !== lastClass) reference = { ...base };
      lastClass = klass;
      const mark = extentsOf(markInk);
      offsets.push(toPx({ x: markX(reference, mark, klass), y: markY(reference, mark, klass, yGap) }));
    }
    return offsets;
  };
}
