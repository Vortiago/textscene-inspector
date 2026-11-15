/**
 * `ColorPickerShapeWheel` (`scene/gui/color_picker_shape.cpp:688-853`): the hue ring through the wheel
 * shader, the SV square inside it, and the hue cursor on the ring.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { circleCursorCentre, rectCursorCentre, shapeDrawing, type ShapeVariant } from './shapeDrawing';
import type { ShapeFragment } from './shapeFragment';

/** `WHEEL_RADIUS` (`color_picker_shape.h:173`): the ring's inner radius, as a fraction of the control. */
const WHEEL_RADIUS = 0.42;

/** The wheel shader (`color_picker_shape.cpp:38-62`). */
const WHEEL_FRAGMENT: ShapeFragment = {
  name: 'wheel',
  uniforms: ['wheel_radius'],
  usesOkColor: false,
  body: `	float x = UV.x - 0.5;
	float y = UV.y - 0.5;
	float a = atan(y, x);
	x += 0.001;
	y += 0.001;
	float b = float(sqrt(x * x + y * y) < 0.5) * float(sqrt(x * x + y * y) > wheel_radius);
	x -= 0.002;
	float b2 = float(sqrt(x * x + y * y) < 0.5) * float(sqrt(x * x + y * y) > wheel_radius);
	y -= 0.002;
	float b3 = float(sqrt(x * x + y * y) < 0.5) * float(sqrt(x * x + y * y) > wheel_radius);
	x += 0.002;
	float b4 = float(sqrt(x * x + y * y) < 0.5) * float(sqrt(x * x + y * y) > wheel_radius);

	COLOR = vec4(clamp((abs(fract(((a - TAU) / TAU) + vec3(3.0, 2.0, 1.0) / 3.0) * 6.0 - 3.0) - 1.0), 0.0, 1.0), (b + b2 + b3 + b4) / 4.00);`,
};

/** The hue cursor's radius: halfway between the ring's inner and outer edge (`_wheel_uv_draw`, `:801-802`). */
const HUE_CURSOR_RADIUS = WHEEL_RADIUS * 2 + (1 - WHEEL_RADIUS * 2) * 0.5;

export const HSV_WHEEL: ShapeVariant = {
  icon: 'shape_rect_wheel',
  controls: [
    {
      // `_wheel_draw` (`:786-788`): a white rect through the wheel shader.
      name: 'wheel',
      type: 'Control',
      minimum: 'area',
      draw: (rect) =>
        shapeDrawing({ fill: { rect, fragment: WHEEL_FRAGMENT, uniforms: { wheel_radius: WHEEL_RADIUS } } }),
      children: [
        {
          // `_wheel_uv_draw` (`:790-807`): the SV square inside the ring, its cursor, then the hue cursor.
          name: 'wheel_uv',
          type: 'Control',
          minimum: 'none',
          fillsParent: true,
          draw: (rect, { hsv }) => {
            const ringRadius = {
              x: rect.w * Math.SQRT1_2 * WHEEL_RADIUS,
              y: rect.h * Math.SQRT1_2 * WHEEL_RADIUS,
            };
            const square = {
              x: rect.x + rect.w * 0.5 - ringRadius.x,
              y: rect.y + rect.h * 0.5 - ringRadius.y,
              w: ringRadius.x * 2,
              h: ringRadius.y * 2,
            };
            return shapeDrawing({
              svSquare: { rect: square, hue: hsv.h },
              cursors: [
                { centre: rectCursorCentre(square, hsv.s, 1 - hsv.v), hasBackground: true },
                { centre: circleCursorCentre(rect, hsv.h, HUE_CURSOR_RADIUS), hasBackground: false },
              ],
            });
          },
        },
      ],
    },
  ],
};
