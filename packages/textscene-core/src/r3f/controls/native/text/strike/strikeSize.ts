/**
 * The strike a face with colour glyphs and fixed sizes draws a font size from, as Godot picks it
 * (`text_server_adv.cpp:1486-1498`), and the FreeType size `FT_Select_Size` gives that face
 * (`ttdriver.c`, `tt_size_select`; `ftobjs.c`, `FT_Select_Metrics`).
 */
import { ftDivFix, ftMulFix, pixCeil, pixFloor } from '../fontMetrics';
import type { SbitStrike } from './sbitStrikes';

/** The FreeType size of a face drawn from a strike, and the scale Godot draws it at. */
export interface StrikeSize {
  readonly strike: SbitStrike;
  /** `size->metrics.x_ppem`: the px size every glyph of the face loads at. */
  readonly ppem: number;
  /** `size->metrics.x_scale` in 16.16: an `hmtx` advance at this scale is HarfBuzz's advance. */
  readonly xScale: number;
  /** `size->metrics.ascender` and `descender` in 26.6, the descender below the baseline negative. */
  readonly ascender: number;
  readonly descender: number;
  /** `fd->scale`: the font size over the strike's width, which every advance, ascent and quad is drawn at. */
  readonly scale: number;
}

/** The face's own ascender and descender in design units, signed, which a scalable face scales to the strike. */
export interface ScalableExtent {
  readonly unitsPerEm: number;
  readonly ascender: number;
  readonly descender: number;
}

/**
 * The strike nearest `fontSizePx` by width, the first of a tie, and its size. A scalable face takes
 * its metrics from its own extent at the strike's ppem (`FT_Select_Metrics`), and a face of bitmaps
 * alone from the strike's own (`tt_face_load_strike_metrics`).
 */
export function strikeSizeAt(
  strikes: readonly SbitStrike[],
  fontSizePx: number,
  scalable: ScalableExtent | null
): StrikeSize {
  let strike = strikes[0]!;
  let difference = Math.trunc(Math.abs(fontSizePx - strike.width));
  for (const candidate of strikes.slice(1)) {
    const candidateDifference = Math.trunc(Math.abs(fontSizePx - candidate.width));
    if (candidateDifference < difference) {
      strike = candidate;
      difference = candidateDifference;
    }
  }
  const scale = fontSizePx / strike.width;
  const { metrics } = strike;
  if (!scalable) {
    const { xPpem, xScale, ascender, descender } = metrics;
    return { strike, ppem: xPpem, xScale, ascender, descender, scale };
  }
  const xScale = ftDivFix(metrics.xPpem * 64, scalable.unitsPerEm);
  const yScale = ftDivFix(metrics.yPpem * 64, scalable.unitsPerEm);
  return {
    strike,
    ppem: metrics.xPpem,
    xScale,
    ascender: pixCeil(ftMulFix(scalable.ascender, yScale)),
    descender: pixFloor(ftMulFix(scalable.descender, yScale)),
    scale,
  };
}
