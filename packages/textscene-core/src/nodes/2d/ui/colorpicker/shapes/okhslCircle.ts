/**
 * `ColorPickerShapeOKHSLCircle` (`scene/gui/color_picker_shape.cpp:998-1092`): the OKHSL hue and
 * saturation disc at the current lightness, and the lightness slider beside it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { circleCursorCentre, okLightnessSlider, requireSlider, type ShapeVariant } from './shapeDrawing';
import type { ShapeFragment } from './shapeFragment';
import { CIRCLE_LAYOUT } from './shapeRow';

/** The OK colour HSL circle shader (`color_picker_shape.cpp:89-111`). */
const OKHSL_CIRCLE_FRAGMENT: ShapeFragment = {
  name: 'okhsl-circle',
  uniforms: ['ok_hsl_l'],
  usesOkColor: true,
  body: `	float x = UV.x - 0.5;
	float y = UV.y - 0.5;
	float h = atan(y, x) / (2.0 * M_PI);
	float s = sqrt(x * x + y * y) * 2.0;
	vec3 col = okhsl_to_srgb(vec3(h, s, ok_hsl_l));
	x += 0.001;
	y += 0.001;
	float b = float(sqrt(x * x + y * y) < 0.5);
	x -= 0.002;
	float b2 = float(sqrt(x * x + y * y) < 0.5);
	y -= 0.002;
	float b3 = float(sqrt(x * x + y * y) < 0.5);
	x += 0.002;
	float b4 = float(sqrt(x * x + y * y) < 0.5);
	COLOR = vec4(col, (b + b2 + b3 + b4) / 4.00);`,
};

export const OKHSL_CIRCLE: ShapeVariant = {
  icon: 'shape_circle',
  layout: CIRCLE_LAYOUT,
  draw(split, { okhsl }) {
    const { h, s, l } = okhsl;
    return {
      fill: { rect: split.area, fragment: OKHSL_CIRCLE_FRAGMENT, uniforms: { ok_hsl_l: l } },
      svSquare: null,
      cursors: [{ centre: circleCursorCentre(split.area, h, s), hasBackground: true }],
      slider: okLightnessSlider(requireSlider(split), okhsl),
    };
  },
};
