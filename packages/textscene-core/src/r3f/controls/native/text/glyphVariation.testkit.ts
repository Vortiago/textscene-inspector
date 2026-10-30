/**
 * The glyph contours that Godot 4.6.3 `TextServer.font_get_glyph_contours` returns for a
 * `FontVariation`, as the JSON references hold them, and the steps that turn one back into the
 * `ScaledOutline` FreeType holds.
 */

import plainReference from './ftEmbolden.godot.json';
import type { ContourTag, GlyphContours, ScaledOutline } from './glyphContours';
import type { GlyphVariation } from './fontMetrics';
import { openFontOutlines } from './sfntOutlines';
import { fixtureFontBytes } from './sfntOutlines.testkit';

export interface ReferenceGlyph {
  font: string;
  char: string;
  sizePx: number;
  embolden: number;
  /** The shear of `variation_transform`. Absent is 0. */
  skew?: number;
  contourEnds: number[];
  isFillRight: boolean;
  /** `[x, y, tag]` as Godot's `font_get_glyph_contours` returns them. */
  points: [number, number, number][];
}

export const referenceGlyphTitle = (glyph: ReferenceGlyph): string =>
  `${glyph.font} ${glyph.char} at ${glyph.sizePx} px, embolden ${glyph.embolden}, skew ${glyph.skew ?? 0}`;

/** The reference of the same glyph with neither embolden nor skew: Godot's hinted outline before either runs. */
export function plainReferenceGlyph(glyph: ReferenceGlyph): ReferenceGlyph {
  const plain = (plainReference as ReferenceGlyph[]).find(
    (other) =>
      other.embolden === 0 &&
      other.font === glyph.font &&
      other.char === glyph.char &&
      other.sizePx === glyph.sizePx
  );
  if (!plain)
    throw new Error(`expected a reference without embolden or skew for ${referenceGlyphTitle(glyph)}`);
  return plain;
}

export const variationOf = ({ embolden, skew }: ReferenceGlyph): GlyphVariation => ({ embolden, skew });

/** The contours the reader gives the font of `glyph` for its character, size and variation. */
export async function readerContours(glyph: ReferenceGlyph): Promise<GlyphContours> {
  const outlines = (await openFontOutlines(fixtureFontBytes(glyph.font)))!;
  return outlines.glyphContours(
    outlines.glyphIndex(glyph.char.codePointAt(0)!),
    glyph.sizePx,
    variationOf(glyph)
  )!;
}

export function toScaledOutline({ points, contourEnds }: ReferenceGlyph): ScaledOutline {
  return {
    x: points.map(([x]) => x * 64),
    y: points.map(([, y]) => -y * 64),
    tags: points.map(([, , tag]) => tag as ContourTag),
    contourEnds: [...contourEnds],
  };
}

/** The points with `-0` turned into `0`, as the JSON reference holds them. */
export function referencePoints(points: readonly { x: number; y: number; tag: number }[]): number[][] {
  return points.map(({ x, y, tag }) => [x + 0, y + 0, tag]);
}
