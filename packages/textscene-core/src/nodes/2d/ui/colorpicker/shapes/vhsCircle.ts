/**
 * `ColorPickerShapeVHSCircle` (`scene/gui/color_picker_shape.cpp:913-996`): the hue and saturation
 * disc through the circle shader at the current value, and the value slider beside it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { hsvToRgb } from '../../../../../godot/math/color';
import { circleCursorCentre, requireSlider, valueSlider, type ShapeVariant } from './shapeDrawing';
import type { ShapeFragment } from './shapeFragment';
import { CIRCLE_LAYOUT } from './shapeRow';
import { BLACK } from '../svGradient';

/** The circle shader (`color_picker_shape.cpp:64-87`). */
const VHS_CIRCLE_FRAGMENT: ShapeFragment = {
  name: 'vhs-circle',
  uniforms: ['v'],
  usesOkColor: false,
  body: `	float x = UV.x - 0.5;
	float y = UV.y - 0.5;
	float a = atan(y, x);
	x += 0.001;
	y += 0.001;
	float b = float(sqrt(x * x + y * y) < 0.5);
	x -= 0.002;
	float b2 = float(sqrt(x * x + y * y) < 0.5);
	y -= 0.002;
	float b3 = float(sqrt(x * x + y * y) < 0.5);
	x += 0.002;
	float b4 = float(sqrt(x * x + y * y) < 0.5);

	COLOR = vec4(mix(vec3(1.0), clamp(abs(fract(vec3((a - TAU) / TAU) + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - vec3(3.0)) - vec3(1.0), 0.0, 1.0), ((float(sqrt(x * x + y * y)) * 2.0)) / 1.0) * vec3(v), (b + b2 + b3 + b4) / 4.00);`,
};

export const VHS_CIRCLE: ShapeVariant = {
  icon: 'shape_circle',
  layout: CIRCLE_LAYOUT,
  draw(split, { hsv }) {
    return {
      fill: { rect: split.area, fragment: VHS_CIRCLE_FRAGMENT, uniforms: { v: hsv.v } },
      svSquare: null,
      cursors: [{ centre: circleCursorCentre(split.area, hsv.h, hsv.s), hasBackground: true }],
      slider: valueSlider(
        requireSlider(split),
        [hsvToRgb(hsv.h, hsv.s, 1), BLACK],
        hsv.v,
        hsvToRgb(hsv.h, 1, hsv.v)
      ),
    };
  },
};
