/**
 * The Controls one `picker_shape` adds to the picker's shape row, and what each one's `draw`
 * callback draws, as plain data: the interface every shape variant returns and `ShapeRow.tsx`
 * paints. Each variant ports one `ColorPickerShape` subclass (`scene/gui/color_picker_shape.cpp`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2 } from '../../../../../godot/math/rect2';
import type { Rgba } from '../../../../../godot/math/math';
import type { Vector2 } from '../../../../../godot/math/vector';
import type { COLOR_PICKER_SHAPE_ICONS } from '../../../../../r3f/controls/native/themeIcons';
import { inverted } from '../../../../../godot/math/color';
import { clamp } from '../../../../../godot/math/math';
import { extractHsv } from '../colorModes';
import { okhslToSrgb, srgbToOkhsl } from '../okhsl';
import type { ShapeFragment } from './shapeFragment';

/**
 * The picker's colour as the shapes read it: `h`, `s`, `v` and `ok_hsl_h`, `ok_hsl_s`, `ok_hsl_l`
 * of `color_normalized` (`_copy_normalized_to_hsv_okhsl`, `color_picker.cpp:552-565`).
 */
export interface PickerShapeColor {
  hsv: { h: number; s: number; v: number };
  okhsl: { h: number; s: number; l: number };
}

/** `okhsl` converts on first read, so only the three OKHSL shapes pay for the OKLab round trip. */
export function pickerShapeColor(normalized: Rgba): PickerShapeColor {
  let okhsl: PickerShapeColor['okhsl'] | undefined;
  return {
    hsv: extractHsv(normalized),
    get okhsl() {
      return (okhsl ??= srgbToOkhsl(normalized));
    },
  };
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

/** Every part is optional, so one painter draws every shape Control. Positions are in the Control's own frame. */
export interface ShapeDrawing {
  fill: ShapeShaderFill | null;
  svSquare: SvSquare | null;
  cursors: readonly ShapeCursor[];
  slider: ShapeSlider | null;
}

/** A drawing of `parts`, with nothing else. */
export function shapeDrawing(parts: Partial<ShapeDrawing>): ShapeDrawing {
  return { fill: null, svSquare: null, cursors: [], slider: null, ...parts };
}

/** What a shape Control's `draw` callback draws over `rect`, its own `(0, 0, size)`. */
export type ShapeDraw = (rect: Rect2, color: PickerShapeColor) => ShapeDrawing;

/** One Control a shape's `_initialize_controls` adds, with the Controls it holds. */
export interface ShapeControl {
  name: string;
  /** `rectangle_margin` of the OK rectangles is a MarginContainer, every other one a plain Control. */
  type: 'Control' | 'MarginContainer';
  /**
   * The `custom_minimum_size` its `update_theme` sets: `sv_width` by `sv_height` for the shape area,
   * `h_width` by 0 for the slider beside it, none for a Control inside the area.
   */
  minimum: 'area' | 'slider' | 'none';
  /** `SIZE_EXPAND_FILL` across: the area of a rectangle takes what the slider leaves. */
  isExpanding?: boolean;
  /** `set_anchors_and_offsets_preset(PRESET_FULL_RECT)`: it covers its parent. */
  fillsParent?: boolean;
  draw?: ShapeDraw;
  children?: readonly ShapeControl[];
}

/** The theme icon `btn_shape` shows for the shape (`color_picker_shape.h:108-227`). */
export type ShapeIconName = keyof typeof COLOR_PICKER_SHAPE_ICONS;

/** One `ColorPickerShape` subclass: its `btn_shape` icon and the Controls it adds to `shape_container`. */
export interface ShapeVariant {
  icon: ShapeIconName;
  controls: readonly ShapeControl[];
}

/** `value_slider` beside a circle or an OK rectangle (`color_picker_shape.cpp:494,892`), drawn by `draw`. */
function valueSliderControl(draw: (rect: Rect2, color: PickerShapeColor) => ShapeSlider): ShapeControl {
  return {
    name: 'value_slider',
    type: 'Control',
    minimum: 'slider',
    draw: (rect, color) => shapeDrawing({ slider: draw(rect, color) }),
  };
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
 * The OKHSL lightness slider of the OKHSL circle and the OK HS rectangle (`color_picker_shape.cpp:568-600`, `:1047-1079`): the stops at lightness 1, 0.5 and 0, and the line in the full-saturation colour.
 */
export function okLightnessSlider(rect: Rect2, { h, s, l }: PickerShapeColor['okhsl']): ShapeSlider {
  return valueSlider(
    rect,
    [okhslToSrgb(h, s, 1), okhslToSrgb(h, s, 0.5), okhslToSrgb(h, s, 0)],
    l,
    okhslToSrgb(h, 1, l)
  );
}

/**
 * The OKHSL saturation slider of the OK HL rectangle (`color_picker_shape.cpp:651-686`): the stops at
 * saturation 1, 0.5 and 0, and the line in the full-saturation colour.
 */
export function okSaturationSlider(rect: Rect2, { h, s, l }: PickerShapeColor['okhsl']): ShapeSlider {
  const saturated = okhslToSrgb(h, 1, l);
  return valueSlider(rect, [saturated, okhslToSrgb(h, 0.5, l), okhslToSrgb(h, 0, l)], s, saturated);
}

/**
 * The Controls of a circle (`ColorPickerShapeCircle::_initialize_controls`, `color_picker_shape.cpp:875-901`):
 * `circle`, which `fill` draws through its shader, `circle_overlay` over it with the cursor at `cursor`,
 * and `value_slider`.
 */
export function circleControls(
  fill: (rect: Rect2, color: PickerShapeColor) => ShapeShaderFill,
  cursor: (color: PickerShapeColor) => { hue: number; saturation: number },
  slider: (rect: Rect2, color: PickerShapeColor) => ShapeSlider
): ShapeControl[] {
  return [
    {
      name: 'circle',
      type: 'Control',
      minimum: 'area',
      draw: (rect, color) => shapeDrawing({ fill: fill(rect, color) }),
      children: [
        {
          name: 'circle_overlay',
          type: 'Control',
          minimum: 'none',
          fillsParent: true,
          draw: (rect, color) => {
            const { hue, saturation } = cursor(color);
            return shapeDrawing({
              cursors: [{ centre: circleCursorCentre(rect, hue, saturation), hasBackground: true }],
            });
          },
        },
      ],
    },
    valueSliderControl(slider),
  ];
}

/**
 * The Controls of an OK rectangle (`ColorPickerShapeOKHSRectangle::_initialize_controls`,
 * `color_picker_shape.cpp:473-504`): `rectangle_margin` holding `square`, which `fill` draws
 * through its shader, and `square_overlay` with the cursor at `cursor`, then `value_slider`.
 */
export function okRectangleControls(
  fill: (rect: Rect2, color: PickerShapeColor) => ShapeShaderFill,
  cursor: (color: PickerShapeColor) => Vector2,
  slider: (rect: Rect2, color: PickerShapeColor) => ShapeSlider
): ShapeControl[] {
  return [
    {
      name: 'rectangle_margin',
      type: 'MarginContainer',
      minimum: 'area',
      isExpanding: true,
      children: [
        {
          name: 'square',
          type: 'Control',
          minimum: 'none',
          draw: (rect, color) => shapeDrawing({ fill: fill(rect, color) }),
        },
        {
          name: 'square_overlay',
          type: 'Control',
          minimum: 'none',
          fillsParent: true,
          draw: (rect, color) => {
            const at = cursor(color);
            return shapeDrawing({
              cursors: [{ centre: rectCursorCentre(rect, at.x, at.y), hasBackground: true }],
            });
          },
        },
      ],
    },
    valueSliderControl(slider),
  ];
}
