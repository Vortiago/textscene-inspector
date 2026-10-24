/**
 * Godot's text alignment enums, which `math_defs.h` declares beside the math constants. A file of
 * their own keeps `math.ts` free of imports, so a Node script can import it with type stripping.
 *
 * `lineStartOffset` is ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
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
export const VERTICAL_ALIGNMENT_FILL = 3;
export type VerticalAlignment =
  | typeof VERTICAL_ALIGNMENT_TOP
  | typeof VERTICAL_ALIGNMENT_CENTER
  | typeof VERTICAL_ALIGNMENT_BOTTOM
  | typeof VERTICAL_ALIGNMENT_FILL;

export const VERTICAL_ALIGNMENT_NAMES = enumNamesByValue({
  VERTICAL_ALIGNMENT_TOP,
  VERTICAL_ALIGNMENT_CENTER,
  VERTICAL_ALIGNMENT_BOTTOM,
  VERTICAL_ALIGNMENT_FILL,
});

/**
 * Where a line of `lineWidth` starts, relative to the origin of a box with no width of its own
 * (`label_3d.cpp:588-599`, `primitive_meshes.cpp:3358-3366`). `FILL` shares `CENTER`'s branch: its
 * justification lives in the width-driven fit, which a line without a width never runs.
 */
export function lineStartOffset(lineWidth: number, alignment: HorizontalAlignment): number {
  switch (alignment) {
    case HORIZONTAL_ALIGNMENT_CENTER:
    case HORIZONTAL_ALIGNMENT_FILL:
      return -lineWidth / 2;
    case HORIZONTAL_ALIGNMENT_RIGHT:
      return -lineWidth;
    default:
      return 0;
  }
}
