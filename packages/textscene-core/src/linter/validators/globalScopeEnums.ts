/**
 * `@GlobalScope` enums re-bound on many classes, spelled as Godot's docs spell
 * them so a diagnostic uses the same word. The labels live here and each slice
 * keeps its own bound: Button's hint offers `"Left,Center,Right"`, Label's adds
 * `Fill`. Same contract as `textServerEnums.ts`.
 */

/**
 * `HorizontalAlignment`: HORIZONTAL_ALIGNMENT_LEFT=0 … _FILL=3
 * (core/math/math_defs.h:80-85).
 */
export const HORIZONTAL_ALIGNMENT = {
  0: 'HORIZONTAL_ALIGNMENT_LEFT',
  1: 'HORIZONTAL_ALIGNMENT_CENTER',
  2: 'HORIZONTAL_ALIGNMENT_RIGHT',
  3: 'HORIZONTAL_ALIGNMENT_FILL',
} as const;

/**
 * `VerticalAlignment`: VERTICAL_ALIGNMENT_TOP=0 … _FILL=3
 * (core/math/math_defs.h:87-92).
 */
export const VERTICAL_ALIGNMENT = {
  0: 'VERTICAL_ALIGNMENT_TOP',
  1: 'VERTICAL_ALIGNMENT_CENTER',
  2: 'VERTICAL_ALIGNMENT_BOTTOM',
  3: 'VERTICAL_ALIGNMENT_FILL',
} as const;
