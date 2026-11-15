/**
 * `ColorPickerShapeRectangle` (`scene/gui/color_picker_shape.cpp:395-471`): `sv_square`, which draws
 * the SV square and its cursor, and `hue_slider`, which draws the `color_hue` rainbow.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { hsvToRgb, inverted } from '../../../../../godot/math/color';
import { COLOR_HUE_STOPS } from '../svGradient';
import { rectCursorCentre, shapeDrawing, sliderLineY, type ShapeVariant } from './shapeDrawing';

export const HSV_RECTANGLE: ShapeVariant = {
  icon: 'shape_rect',
  controls: [
    {
      // `_sv_square_draw` (`:417-419`).
      name: 'sv_square',
      type: 'Control',
      minimum: 'area',
      isExpanding: true,
      draw: (rect, { hsv }) =>
        shapeDrawing({
          svSquare: { rect, hue: hsv.h },
          cursors: [{ centre: rectCursorCentre(rect, hsv.s, 1 - hsv.v), hasBackground: true }],
        }),
    },
    {
      // `_hue_slider_draw` (`:421-434`).
      name: 'hue_slider',
      type: 'Control',
      minimum: 'slider',
      draw: (rect, { hsv }) =>
        shapeDrawing({
          slider: {
            rect,
            stops: COLOR_HUE_STOPS,
            lineY: sliderLineY(rect.h, hsv.h),
            lineColor: inverted(hsvToRgb(hsv.h, 1, 1)),
          },
        }),
    },
  ],
};
