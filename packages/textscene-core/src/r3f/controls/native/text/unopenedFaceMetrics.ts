/**
 * The `FontMetrics` of a face whose bytes FreeType cannot open. Godot keeps its RID in the chain, but
 * the run that reaches it has no HarfBuzz font, so shaping returns before any glyph or later
 * fallback (`text_server_adv.cpp:6917-6935`). It claims every character and draws none, with no
 * advance, ascent or descent, as `_font_get_ascent` answers 0 for it.
 */
import { FixedSizeScaleMode } from '../../../../godot/text/textServerEnums';
import type { BitmapFont, BitmapGlyph, FillSheet } from '../../../../resources/fonts/font/types';
import { createBitmapFontMetrics, type BitmapFontMetrics } from './bitmapFontMetrics';

/** One clear texel, as `noFaceMetrics.ts` holds: no glyph samples it. */
const CLEAR_SHEET: FillSheet = { width: 1, height: 1, data: new Uint8Array(4), rowOffsets: [] };

/** A glyph of no size, no advance and no ink (`fillIndex` -1). */
const NOTHING_DRAWN: BitmapGlyph = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  offsetX: 0,
  offsetY: 0,
  advance: 0,
  fillIndex: -1,
};

const NO_LINE: BitmapFont = {
  fixedSize: 1,
  ascent: 0,
  descent: 0,
  glyphs: new Map(),
  kerning: new Map(),
  sheet: CLEAR_SHEET,
  outlineSheet: CLEAR_SHEET,
  scaleMode: FixedSizeScaleMode.FIXED_SIZE_SCALE_ENABLED,
};

export const UNOPENED_FACE_METRICS: BitmapFontMetrics = {
  ...createBitmapFontMetrics(NO_LINE),
  glyphOf: () => NOTHING_DRAWN,
  hasGlyph: () => true,
  getGlyphAdvanceUnits: () => 0,
};
