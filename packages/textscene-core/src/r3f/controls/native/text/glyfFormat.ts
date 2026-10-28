/**
 * The `glyf` and `loca` binary format that the TrueType reader (`sfntGlyf.ts`) parses and the WOFF2
 * rebuilder (`woff2Glyf.ts`) writes (OpenType spec, "glyf", "loca", "Simple Glyph Description" and
 * "Composite Glyph Description").
 */

export const SHORT_LOCA_FORMAT = 0;
export const LONG_LOCA_FORMAT = 1;

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
export const COMPONENT_HAS_SCALE = 0x0008;
export const COMPONENT_MORE = 0x0020;
export const COMPONENT_HAS_XY_SCALE = 0x0040;
export const COMPONENT_HAS_2X2 = 0x0080;
export const COMPONENT_HAS_INSTRUCTIONS = 0x0100;

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
