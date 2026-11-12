/**
 * What a Shape2D's `draw()` puts on a canvas item, in draw order. Each colour is named by its role
 * against the colour the node draws the shape in, so a drawing holds no colour of its own.
 */

import { inverted } from '../../../godot/math/color';
import type { Rgba } from '../../../godot/math/math';
import type { Vector2 } from '../../../godot/math/vector';

/**
 * `shape`: the colour as given. `opaque`: `Color(color, 1.0)`. `clear`: `Color(color, 0)`.
 * `inverted`: `color.inverted()`, which keeps the alpha.
 */
export type ColourRole = 'shape' | 'opaque' | 'clear' | 'inverted';

export type ShapeCommand =
  /** `canvas_item_add_polygon`, `canvas_item_add_rect` or a primitive: one colour, any simple polygon. */
  | { kind: 'fill'; points: readonly Vector2[]; role: ColourRole }
  /** `canvas_item_add_polyline` with no width: a one pixel line strip in one colour. */
  | { kind: 'hairline'; points: readonly Vector2[]; role: ColourRole }
  /** `canvas_item_add_line` or `canvas_item_add_polyline` with a width: a stroke, a role for each point. */
  | { kind: 'stroke'; points: readonly Vector2[]; width: number; roles: readonly ColourRole[] };

export type ShapeDrawing = readonly ShapeCommand[];

export function roleColour(role: ColourRole, colour: Rgba): Rgba {
  switch (role) {
    case 'shape':
      return colour;
    case 'opaque':
      return { ...colour, a: 1 };
    case 'clear':
      return { ...colour, a: 0 };
    case 'inverted':
      return inverted(colour);
  }
}
