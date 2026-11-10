/**
 * Godot's text alignment enums, which `math_defs.h` declares beside the math constants. A file of
 * their own keeps `math.ts` free of imports, so a Node script can import it with type stripping.
 *
 * `lineStartOffset` is ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { enumNamesByValue, type EnumValue } from '../classdb/enumNames.js';

/** `HorizontalAlignment` (`core/math/math_defs.h:80-85`). */
export const HorizontalAlignment = {
  HORIZONTAL_ALIGNMENT_LEFT: 0,
  HORIZONTAL_ALIGNMENT_CENTER: 1,
  HORIZONTAL_ALIGNMENT_RIGHT: 2,
  HORIZONTAL_ALIGNMENT_FILL: 3,
} as const;

export const HORIZONTAL_ALIGNMENT_NAMES = enumNamesByValue(HorizontalAlignment);

/** `VerticalAlignment` (`core/math/math_defs.h:87-92`). */
export const VerticalAlignment = {
  VERTICAL_ALIGNMENT_TOP: 0,
  VERTICAL_ALIGNMENT_CENTER: 1,
  VERTICAL_ALIGNMENT_BOTTOM: 2,
  VERTICAL_ALIGNMENT_FILL: 3,
} as const;

export const VERTICAL_ALIGNMENT_NAMES = enumNamesByValue(VerticalAlignment);

/**
 * Where a line of `lineWidth` starts, relative to the origin (`label_3d.cpp:588-599`,
 * `primitive_meshes.cpp:3358-3366`). `FILL` shares `CENTER`'s branch: the stretch to `width` is done
 * beforehand, so a justified line is already as wide as the box and a short last line centres.
 */
export function lineStartOffset(lineWidth: number, alignment: EnumValue<typeof HorizontalAlignment>): number {
  switch (alignment) {
    case HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER:
    case HorizontalAlignment.HORIZONTAL_ALIGNMENT_FILL:
      return -lineWidth / 2;
    case HorizontalAlignment.HORIZONTAL_ALIGNMENT_RIGHT:
      return -lineWidth;
    default:
      return 0;
  }
}

/**
 * `vbegin` (`primitive_meshes.cpp:3321-3336`, `label_3d.cpp:567-580`): how far above the origin the
 * first line's top sits. TOP and FILL hang the block below the origin.
 */
export function blockStartY(
  alignment: EnumValue<typeof VerticalAlignment>,
  blockHeight: number,
  spacing: number
): number {
  switch (alignment) {
    case VerticalAlignment.VERTICAL_ALIGNMENT_CENTER:
      return (blockHeight - spacing) / 2;
    case VerticalAlignment.VERTICAL_ALIGNMENT_BOTTOM:
      return blockHeight - spacing;
    default:
      return 0;
  }
}
