/**
 * The `FontMetrics` of a font with no face, which Godot gives no RID: every character draws as a
 * hex-code box, and the line holds the box, `size.y * 0.85` above the baseline and `size.y * 0.15`
 * below it (`text_server_adv.cpp:6886-6889`). A BMFont with no glyphs gives the shaper that box.
 */
import { FixedSizeScaleMode } from '../../../../godot/text/textServerEnums';
import type { BitmapFont, FillSheet } from '../../../../resources/fonts/font/types';
import { createBitmapFontMetrics, type BitmapFontMetrics } from './bitmapFontMetrics';
import { hexCodeBoxCellPx } from './hexCodeBox';

/** The cells of a hex-code box frame, top to bottom (`text_server.cpp:741`). */
const HEX_CODE_BOX_CELLS_HIGH = 15;

/** One clear texel: a run samples no glyph from it, and a texture of zero size is not a valid upload. */
const CLEAR_SHEET: FillSheet = { width: 1, height: 1, data: new Uint8Array(4), rowOffsets: [] };

const NO_GLYPHS: BitmapFont = {
  fixedSize: HEX_CODE_BOX_CELLS_HIGH,
  ascent: HEX_CODE_BOX_CELLS_HIGH * 0.85,
  descent: HEX_CODE_BOX_CELLS_HIGH * 0.15,
  glyphs: new Map(),
  kerning: new Map(),
  sheet: CLEAR_SHEET,
  outlineSheet: CLEAR_SHEET,
  scaleMode: FixedSizeScaleMode.FIXED_SIZE_SCALE_INTEGER_ONLY,
};

/** Scaled by the cell size, which is at least 1 px where a BMFont's integer scale rounds to 0. */
export const NO_FACE_METRICS: BitmapFontMetrics = {
  ...createBitmapFontMetrics(NO_GLYPHS),
  pxPerUnit: hexCodeBoxCellPx,
};
