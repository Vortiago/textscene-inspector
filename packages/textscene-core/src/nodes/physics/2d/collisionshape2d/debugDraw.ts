/** What a CollisionShape2D draws around its shape (`collision_shape_2d.cpp:98-127`): grey when disabled, an arrow when one-way. */

import { colorValue, darkened } from '../../../../godot/math/color';
import type { Rgba } from '../../../../godot/math/math';
import { roleColour, type ShapeDrawing } from '../../../../resources/shapes/shape2d/drawing';

/** The colour the shape draws in: the debug colour, or its value as a grey at half the alpha when disabled. */
export function drawColour(debugColour: Rgba, isDisabled: boolean): Rgba {
  if (!isDisabled) return debugColour;
  const grey = colorValue(debugColour);
  return { r: grey, g: grey, b: grey, a: debugColour.a * 0.5 };
}

const DISABLED_ARROW_DARKENING = 0.25;

export function oneWayArrowColour(debugColour: Rgba, isDisabled: boolean): Rgba {
  const arrow = roleColour('inverted', debugColour);
  return isDisabled ? darkened(arrow, DISABLED_ARROW_DARKENING) : arrow;
}

const ARROW_LENGTH = 20;
const ARROW_HEAD_SIZE = 8;
/** `Math::SQRT12` is the square root of one half (`math_defs.h`). */
const HEAD_HALF_WIDTH = Math.SQRT1_2 * ARROW_HEAD_SIZE;

/** The down arrow of one-way collision, drawn in the colour `oneWayArrowColour` gives. */
export const ONE_WAY_ARROW: ShapeDrawing = [
  {
    kind: 'stroke',
    points: [
      { x: 0, y: 0 },
      { x: 0, y: ARROW_LENGTH },
    ],
    width: 2,
    roles: ['shape', 'shape'],
  },
  {
    kind: 'fill',
    points: [
      { x: 0, y: ARROW_LENGTH + ARROW_HEAD_SIZE },
      { x: HEAD_HALF_WIDTH, y: ARROW_LENGTH },
      { x: -HEAD_HALF_WIDTH, y: ARROW_LENGTH },
    ],
    role: 'shape',
  },
];
