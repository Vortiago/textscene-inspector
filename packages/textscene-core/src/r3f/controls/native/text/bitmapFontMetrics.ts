/**
 * The `FontMetrics` of a BMFont `FontFile`, a fixed-size face whose glyphs are page images. Its
 * units are the pixels of the fixed size (`unitsPerEm` is that size), and Godot scales every length
 * by the ratio of the drawn size to it (`text_server_adv.cpp:2907-2912`). The shaper in
 * `textLayout.ts` stays the one shaper: it reads the scale through `FontMetrics.pxPerUnit`.
 */

import { FixedSizeScaleMode } from '../../../../godot/text/textServerEnums';
import { round as godotRound } from '../../../../godot/math/math';
import { kerningKey } from '../../../../resources/formats/bmfont/parseDescriptor';
import type { BitmapFont, BitmapGlyph } from '../../../../resources/fonts/font/types';
import type { FontMetrics } from './fontMetrics';

/** `FontMetrics` drawn from page images by `bitmapTextPainter.ts`. `TextRun.tsx` dispatches on `kind`. */
export interface BitmapFontMetrics extends FontMetrics {
  readonly kind: 'bitmap';
  readonly bitmap: BitmapFont;
  /** The glyph of a character, or undefined when the font lacks it: Godot then draws a hex-code box. */
  glyphOf(ch: string): BitmapGlyph | undefined;
  /** `bitmapScale` at a size: always present on a bitmap face. */
  pxPerUnit(fontSizePx: number): number;
}

export function isBitmapFontMetrics(metrics: FontMetrics | undefined): metrics is BitmapFontMetrics {
  return metrics?.kind === 'bitmap';
}

/**
 * The factor a glyph measure at the fixed size is drawn at, `font_size / fixed_size` under the
 * enabled mode, its rounding under the integer-only mode and 1 under the disabled mode
 * (`text_server_adv.cpp:2907-2912,3052-3057`). A size equal to the fixed size is 1 in every mode.
 */
function bitmapScale(scaleMode: number, fixedSize: number, fontSizePx: number): number {
  if (fontSizePx === fixedSize || scaleMode === FixedSizeScaleMode.FIXED_SIZE_SCALE_DISABLE) return 1;
  const ratio = fontSizePx / fixedSize;
  return scaleMode === FixedSizeScaleMode.FIXED_SIZE_SCALE_ENABLED ? ratio : godotRound(ratio);
}

export function createBitmapFontMetrics(bitmap: BitmapFont): BitmapFontMetrics {
  const glyphOf = (ch: string): BitmapGlyph | undefined => bitmap.glyphs.get(ch.codePointAt(0)!);
  return {
    kind: 'bitmap',
    bitmap,
    glyphOf,
    unitsPerEm: bitmap.fixedSize,
    ascent: bitmap.ascent,
    descent: bitmap.descent,
    pxPerUnit: (fontSizePx) => bitmapScale(bitmap.scaleMode, bitmap.fixedSize, fontSizePx),
    getGlyphAdvanceUnits: (ch) => glyphOf(ch)?.advance ?? null,
    getKerningAdjustmentUnits: (a, b) =>
      bitmap.kerning.get(kerningKey(a.codePointAt(0)!, b.codePointAt(0)!)) ?? 0,
    // A character the font lacks has no advance of its own: the shaper gives it a hex-code box.
    averageAdvanceUnits: 0,
  };
}
