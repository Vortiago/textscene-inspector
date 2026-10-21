/**
 * Godot's text alignment enums, which `math_defs.h` declares beside the math constants. A file of
 * their own keeps `math.ts` free of imports, so a Node script can import it with type stripping.
 */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `HorizontalAlignment` (`core/math/math_defs.h:80-85`). */
export const HORIZONTAL_ALIGNMENT_LEFT = 0;
export const HORIZONTAL_ALIGNMENT_CENTER = 1;
export const HORIZONTAL_ALIGNMENT_RIGHT = 2;
export const HORIZONTAL_ALIGNMENT_FILL = 3;
export type HorizontalAlignment =
  | typeof HORIZONTAL_ALIGNMENT_LEFT
  | typeof HORIZONTAL_ALIGNMENT_CENTER
  | typeof HORIZONTAL_ALIGNMENT_RIGHT
  | typeof HORIZONTAL_ALIGNMENT_FILL;

export const HORIZONTAL_ALIGNMENT_NAMES = enumNamesByValue({
  HORIZONTAL_ALIGNMENT_LEFT,
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_RIGHT,
  HORIZONTAL_ALIGNMENT_FILL,
});

/** `VerticalAlignment` (`core/math/math_defs.h:87-92`). */
export const VERTICAL_ALIGNMENT_TOP = 0;
export const VERTICAL_ALIGNMENT_CENTER = 1;
export const VERTICAL_ALIGNMENT_BOTTOM = 2;
const VERTICAL_ALIGNMENT_FILL = 3;

export const VERTICAL_ALIGNMENT_NAMES = enumNamesByValue({
  VERTICAL_ALIGNMENT_TOP,
  VERTICAL_ALIGNMENT_CENTER,
  VERTICAL_ALIGNMENT_BOTTOM,
  VERTICAL_ALIGNMENT_FILL,
});
