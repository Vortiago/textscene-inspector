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
import { rectCursorCentre, requireSlider, sliderLineY, type ShapeVariant } from './shapeDrawing';

export const HSV_RECTANGLE: ShapeVariant = {
  icon: 'shape_rect',
  draw(split, { hsv }) {
    const slider = requireSlider(split);
    return {
      fill: null,
      svSquare: { rect: split.area, hue: hsv.h },
      cursors: [{ centre: rectCursorCentre(split.area, hsv.s, 1 - hsv.v), hasBackground: true }],
      slider: {
        rect: slider,
        stops: COLOR_HUE_STOPS,
        lineY: sliderLineY(slider.h, hsv.h),
        lineColor: inverted(hsvToRgb(hsv.h, 1, 1)),
      },
    };
  },
};
