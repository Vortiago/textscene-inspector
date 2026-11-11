/**
 * `ColorPickerShapeRectangle` (`scene/gui/color_picker_shape.cpp:395-471`): the SV square, and the
 * `color_hue` rainbow in `hue_slider`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { hsvToRgb, inverted } from '../../../../../godot/math/color';
import { COLOR_HUE_STOPS } from '../svGradient';
import { rectCursorCentre, sliderLineY, type ShapeVariant } from './shapeDrawing';
import { RECTANGLE_LAYOUT, type SliderRowLayout } from './shapeRowLayout';

export const HSV_RECTANGLE: ShapeVariant<SliderRowLayout> = {
  icon: 'shape_rect',
  layout: RECTANGLE_LAYOUT,
  draw({ area, slider }, { hsv }) {
    return {
      fill: null,
      svSquare: { rect: area, hue: hsv.h },
      cursors: [{ centre: rectCursorCentre(area, hsv.s, 1 - hsv.v), hasBackground: true }],
      slider: {
        rect: slider,
        stops: COLOR_HUE_STOPS,
        lineY: sliderLineY(slider.h, hsv.h),
        lineColor: inverted(hsvToRgb(hsv.h, 1, 1)),
      },
    };
  },
};
