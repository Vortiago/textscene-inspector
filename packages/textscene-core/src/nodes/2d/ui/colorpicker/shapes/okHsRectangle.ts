/**
 * `ColorPickerShapeOKHSRectangle` (`scene/gui/color_picker_shape.cpp:473-600`): the OKHSL hue and
 * saturation square at the current lightness, and the lightness slider beside it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { okLightnessSlider, rectCursorCentre, requireSlider, type ShapeVariant } from './shapeDrawing';
import type { ShapeFragment } from './shapeFragment';
import { RECTANGLE_LAYOUT } from './shapeRowLayout';

/** The OK colour HS rectangle shader (`color_picker_shape.cpp:113-124`). */
const OK_HS_RECTANGLE_FRAGMENT: ShapeFragment = {
  name: 'ok-hs-rectangle',
  uniforms: ['ok_hsl_l'],
  usesOkColor: true,
  body: `	float h = UV.x;
	float s = 1.0 - UV.y;
	vec3 col = okhsl_to_srgb(vec3(h, s, ok_hsl_l));
	COLOR = vec4(col, 1.0);`,
};

export const OK_HS_RECTANGLE: ShapeVariant = {
  icon: 'shape_rect',
  layout: RECTANGLE_LAYOUT,
  draw(split, { okhsl }) {
    const { h, s, l } = okhsl;
    return {
      fill: { rect: split.area, fragment: OK_HS_RECTANGLE_FRAGMENT, uniforms: { ok_hsl_l: l } },
      svSquare: null,
      cursors: [{ centre: rectCursorCentre(split.area, h, 1 - s), hasBackground: true }],
      slider: okLightnessSlider(requireSlider(split), okhsl),
    };
  },
};
