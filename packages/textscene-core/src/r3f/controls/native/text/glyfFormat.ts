/**
 * The `glyf` and `loca` binary format that the TrueType reader (`sfntGlyf.ts`) parses and the WOFF2
 * rebuilder (`woff2Glyf.ts`) writes (OpenType spec, "glyf", "loca", "Simple Glyph Description" and
 * "Composite Glyph Description").
 */

import { toInt16 } from '../../../../godot/variant/intWidth';

export const SHORT_LOCA_FORMAT = 0;
export const LONG_LOCA_FORMAT = 1;

/** A glyph's header: numberOfContours(2), then xMin, yMin, xMax and yMax(2 each). */
export const GLYPH_HEADER_SIZE = 10;
export const GLYPH_X_MIN_OFFSET = 2;
export const GLYPH_Y_MAX_OFFSET = 8;

/** The `glyf` offset of `loca` entry `index`: a long entry, or a short one, which counts words. */
export function locaEntry(dv: DataView, locaOffset: number, index: number, isLongLoca: boolean): number {
  return isLongLoca
    ? dv.getUint32(locaOffset + index * 4, false)
    : dv.getUint16(locaOffset + index * 2, false) * 2;
}

/** The `xMin` of a glyph's header, or 0 for a glyph of no bytes. */
export function glyphXMin(glyph: Uint8Array): number {
  if (glyph.length === 0) return 0;
  return toInt16((glyph[GLYPH_X_MIN_OFFSET]! << 8) | glyph[GLYPH_X_MIN_OFFSET + 1]!);
}

// The point flags of a simple glyph.
export const SIMPLE_ON_CURVE = 0x01;
export const SIMPLE_X_SHORT = 0x02;
export const SIMPLE_Y_SHORT = 0x04;
export const SIMPLE_REPEAT = 0x08;
export const SIMPLE_X_SAME_OR_POSITIVE = 0x10;
export const SIMPLE_Y_SAME_OR_POSITIVE = 0x20;

// The flags of a component of a composite glyph.
export const COMPONENT_ARGS_ARE_WORDS = 0x0001;
export const COMPONENT_ARGS_ARE_XY_VALUES = 0x0002;
export const COMPONENT_ROUND_XY_TO_GRID = 0x0004;
export const COMPONENT_HAS_SCALE = 0x0008;
export const COMPONENT_MORE = 0x0020;
export const COMPONENT_HAS_XY_SCALE = 0x0040;
export const COMPONENT_HAS_2X2 = 0x0080;
export const COMPONENT_HAS_INSTRUCTIONS = 0x0100;
export const COMPONENT_USE_MY_METRICS = 0x0200;
export const COMPONENT_SCALED_OFFSET = 0x0800;

/** The bytes of a component's two arguments: words with the flag set, bytes without it. */
export function componentArgumentByteCount(flags: number): number {
  return flags & COMPONENT_ARGS_ARE_WORDS ? 4 : 2;
}

/** The bytes of a component's matrix: one F2Dot14 for a scale, two for x and y, four for a 2x2, none for the identity. */
export function componentMatrixByteCount(flags: number): number {
  if (flags & COMPONENT_HAS_SCALE) return 2;
  if (flags & COMPONENT_HAS_XY_SCALE) return 4;
  return flags & COMPONENT_HAS_2X2 ? 8 : 0;
}
