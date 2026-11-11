/**
 * What one `picker_shape` draws in the shape row, as plain data: the interface every shape variant
 * returns and `ShapeRow.tsx` paints. Each variant ports one `ColorPickerShape` subclass
 * (`scene/gui/color_picker_shape.cpp`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2 } from '../../../../../godot/math/rect2';
import type { Rgba } from '../../../../../godot/math/math';
import type { Vector2 } from '../../../../../godot/math/vector';
import { inverted } from '../../../../../godot/math/color';
import { clamp } from '../../../../../godot/math/math';
import { extractHsv } from '../colorModes';
import { okhslToSrgb, srgbToOkhsl } from '../okhsl';
import type { ShapeFragment } from './shapeFragment';
import type { ShapeRowLayout, ShapeRowSplit } from './shapeRow';

/**
 * The picker's colour as the shapes read it: `h`, `s`, `v` and `ok_hsl_h`, `ok_hsl_s`, `ok_hsl_l`
 * of `color_normalized` (`_copy_normalized_to_hsv_okhsl`, `color_picker.cpp:552-565`).
 */
export interface PickerShapeColor {
  hsv: { h: number; s: number; v: number };
  okhsl: { h: number; s: number; l: number };
}

export function pickerShapeColor(normalized: Rgba): PickerShapeColor {
  return { hsv: extractHsv(normalized), okhsl: srgbToOkhsl(normalized) };
}

/** A fill that a `canvas_item` shader evaluates per fragment over `rect`, with `UV` 0 to 1 and y down. */
export interface ShapeShaderFill {
  rect: Rect2;
  fragment: ShapeFragment;
  /** The value of each uniform the fragment declares. */
  uniforms: Readonly<Record<string, number>>;
}

/**
 * `draw_cursor` (`color_picker_shape.cpp:269-275`): `picker_cursor` centred on `centre`, over
 * `picker_cursor_bg` tinted to the opaque pick colour when `hasBackground` is true.
 */
export interface ShapeCursor {
  centre: Vector2;
  hasBackground: boolean;
}

/** A vertical slider: a strip of evenly spaced stops from top to bottom, and a 1 px line across it. */
export interface ShapeSlider {
  rect: Rect2;
  stops: readonly Rgba[];
  /** The line's row, from the slider's top. */
  lineY: number;
  lineColor: Rgba;
}

/** The two polygons of `draw_sv_square` (`color_picker_shape.cpp:231-257`) over `rect`, at `hue`. */
export interface SvSquare {
  rect: Rect2;
  hue: number;
}

/** Every part is optional, so one painter draws every shape. Positions are in the picker's content frame. */
export interface ShapeDrawing {
  fill: ShapeShaderFill | null;
  svSquare: SvSquare | null;
  cursors: readonly ShapeCursor[];
  slider: ShapeSlider | null;
}

/** The theme icon `btn_shape` shows for the shape (`color_picker_shape.h:108-227`). */
export type ShapeIconName = 'shape_rect' | 'shape_rect_wheel' | 'shape_circle';

/** One `ColorPickerShape` subclass: its `btn_shape` icon, its controls and what it draws in them. */
export interface ShapeVariant {
  icon: ShapeIconName;
  layout: ShapeRowLayout;
  draw(split: ShapeRowSplit, color: PickerShapeColor): ShapeDrawing;
}

/**
 * The cursor of a square overlay at `x` across and `y` down, each 0 to 1, clamped to `rect`
 * (`color_picker_shape.cpp:259-261`, `:546-555`, `:626-635`).
 */
export function rectCursorCentre(rect: Rect2, x: number, y: number): Vector2 {
  return {
    x: clamp(rect.x + rect.w * x, rect.x, rect.x + rect.w),
    y: clamp(rect.y + rect.h * y, rect.y, rect.y + rect.h),
  };
}

/** `draw_circle_cursor` (`color_picker_shape.cpp:277-284`): `hue` turns round the centre of `rect`, at `saturation` of its radius. */
export function circleCursorCentre(rect: Rect2, hue: number, saturation: number): Vector2 {
  const centre = { x: rect.w * 0.5, y: rect.h * 0.5 };
  return {
    x: rect.x + centre.x + centre.x * Math.cos(hue * 2 * Math.PI) * saturation,
    y: rect.y + centre.y + centre.y * Math.sin(hue * 2 * Math.PI) * saturation,
  };
}

/** A slider line's row: `int y = size.y * fraction`, truncated as the int does (`color_picker_shape.cpp:431`, `:984`). */
export function sliderLineY(height: number, fraction: number): number {
  return Math.trunc(height * fraction);
}

/**
 * A value slider (`color_picker_shape.cpp:962-986`, `:568-600`): its line sits at `1 - value` of the
 * height, in the inverted `lineSource`.
 */
export function valueSlider(
  rect: Rect2,
  stops: readonly Rgba[],
  value: number,
  lineSource: Rgba
): ShapeSlider {
  return {
    rect,
    stops,
    lineY: sliderLineY(rect.h, 1 - clamp(value, 0, 1)),
    lineColor: inverted(lineSource),
  };
}

/**
 * The OKHSL lightness slider of the OKHSL circle and the OK HS rectangle (`color_picker_shape.cpp:568-600`,
 * `:1062-1092`): the stops at lightness 1, 0.5 and 0, and the line in the full-saturation colour.
 */
export function okLightnessSlider(rect: Rect2, { h, s, l }: PickerShapeColor['okhsl']): ShapeSlider {
  return valueSlider(
    rect,
    [okhslToSrgb(h, s, 1), okhslToSrgb(h, s, 0.5), okhslToSrgb(h, s, 0)],
    l,
    okhslToSrgb(h, 1, l)
  );
}

/** The slider of a shape that has one: every shape but the wheel. */
export function requireSlider(split: ShapeRowSplit): Rect2 {
  if (!split.slider) throw new Error('expected a shape row split with a slider, got the wheel split');
  return split.slider;
}
