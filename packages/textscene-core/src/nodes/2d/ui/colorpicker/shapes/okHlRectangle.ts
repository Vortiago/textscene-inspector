/**
 * `ColorPickerShapeOKHLRectangle` (`scene/gui/color_picker_shape.cpp:602-686`): the OKHSL hue and
 * lightness square at the current saturation, and the saturation slider beside it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { okRectangleControls, okSaturationSlider, type ShapeVariant } from './shapeDrawing';
import type { ShapeFragment } from './shapeFragment';

/** The OK colour HL rectangle shader (`color_picker_shape.cpp:126-137`). */
const OK_HL_RECTANGLE_FRAGMENT: ShapeFragment = {
  name: 'ok-hl-rectangle',
  uniforms: ['ok_hsl_s'],
  usesOkColor: true,
  body: `	float h = UV.x;
	float l = 1.0 - UV.y;
	vec3 col = okhsl_to_srgb(vec3(h, ok_hsl_s, l));
	COLOR = vec4(col, 1.0);`,
};

export const OK_HL_RECTANGLE: ShapeVariant = {
  icon: 'shape_rect',
  controls: okRectangleControls(
    (rect, { okhsl }) => ({ rect, fragment: OK_HL_RECTANGLE_FRAGMENT, uniforms: { ok_hsl_s: okhsl.s } }),
    ({ okhsl }) => ({ x: okhsl.h, y: 1 - okhsl.l }),
    (rect, { okhsl }) => okSaturationSlider(rect, okhsl)
  ),
};
