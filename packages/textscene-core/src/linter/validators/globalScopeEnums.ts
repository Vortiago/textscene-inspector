/**
 * `@GlobalScope` enums that Godot re-binds on many unrelated classes.
 *
 * Same contract as `textServerEnums.ts`: the LABELS live here because the enum
 * is one enum, and the BOUND stays with each slice because it is not a property
 * of the enum. Button's hint offers `"Left,Center,Right"` while Label's offers
 * `"Left,Center,Right,Fill"` from this same set, and each slice cites which
 * `ADD_PROPERTY` it read.
 *
 * The constants are spelled as `@GlobalScope` names them, so a diagnostic and
 * Godot's own documentation agree on the word. Six private copies had drifted
 * into two spellings of the same value, which put two different names on one
 * number depending on which node type carried it.
 */

/**
 * `HorizontalAlignment` — HORIZONTAL_ALIGNMENT_LEFT=0 … _FILL=3
 * (core/math/math_defs.h:80-85).
 */
export const HORIZONTAL_ALIGNMENT = {
  0: 'HORIZONTAL_ALIGNMENT_LEFT',
  1: 'HORIZONTAL_ALIGNMENT_CENTER',
  2: 'HORIZONTAL_ALIGNMENT_RIGHT',
  3: 'HORIZONTAL_ALIGNMENT_FILL',
} as const;

/**
 * `VerticalAlignment` — VERTICAL_ALIGNMENT_TOP=0 … _FILL=3
 * (core/math/math_defs.h:87-92).
 */
export const VERTICAL_ALIGNMENT = {
  0: 'VERTICAL_ALIGNMENT_TOP',
  1: 'VERTICAL_ALIGNMENT_CENTER',
  2: 'VERTICAL_ALIGNMENT_BOTTOM',
  3: 'VERTICAL_ALIGNMENT_FILL',
} as const;
