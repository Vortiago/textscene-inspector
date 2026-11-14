/**
 * `ColorMode` (`scene/gui/color_mode.h`/`.cpp`): the channel set of each
 * `color_mode`, which the slider grid and the hex field read.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { linearColorToSRGBF32, sRGBColorToLinearF32 } from '../../../../utils/colorSpace';
import { isColorOverbright } from '../shared/colorOverbright';
import { formatGodotNumber } from '../spinbox/nativeSolver';
import { colorHue, colorSaturation, hsvToRgb } from '../../../../godot/math/color';
import { okhslToSrgb, srgbToOkhsl } from './okhsl';
import { COLOR_HUE_STOPS } from './svGradient';
import type { Rgba } from '../../../../godot/math/math';
import { ColorPickerColorMode } from '../../../../godot/scene/gui';
import {
  GradientColorSpace,
  GradientInterpolationMode,
  GradientTexture2DFill,
  GradientTexture2DRepeat,
} from '../../../../godot/scene/gradientTexture';
import type { Gradient, GradientTexture2D } from '../../../../resources/textures/gradienttexture2d/types';

interface HsvColor {
  h: number;
  s: number;
  v: number;
}

/**
 * The HSV of `_set_pick_color` (`color_picker.cpp:324-345`): `_copy_normalized_to_hsv_okhsl`
 * (`:552-565`) reads `color_normalized`, which the caller passes, with `Color::get_h/get_s/get_v`
 * (`core/math/color.cpp:136-180`).
 */
export function extractHsv(normalized: Rgba): HsvColor {
  return {
    h: colorHue(normalized),
    s: colorSaturation(normalized),
    v: Math.max(normalized.r, normalized.g, normalized.b),
  };
}

/** The divisor of `_copy_color_to_normalized_and_intensity` (`color_picker.cpp:593-602`): 1 unless a linear channel exceeds 1. */
function intensityMultiplier(linear: Rgba): number {
  return Math.max(1, linear.r, linear.g, linear.b);
}

/**
 * `_copy_color_to_normalized_and_intensity` (`color_picker.cpp:593-602`): every slider value and
 * gradient stop reads `color_normalized`, not the raw `color`. Only rgb is normalised:
 * `ColorMode::get_alpha_slider_value` reads `get_pick_color()`, so alpha passes through unchanged.
 * The round trip runs in Godot's float steps, since a grey's OKHSL hue is the noise it leaves.
 */
export function colorNormalized(color: Rgba): Rgba {
  const linear = sRGBColorToLinearF32(color);
  const multiplier = intensityMultiplier(linear);
  return linearColorToSRGBF32({
    r: linear.r / multiplier,
    g: linear.g / multiplier,
    b: linear.b / multiplier,
    a: color.a,
  });
}

/** `intensity = Math::log2(multiplier)` (`color_picker.cpp:594,601`): the intensity slider's value in every `color_mode`. */
function colorIntensity(color: Rgba): number {
  return Math.log2(intensityMultiplier(sRGBColorToLinearF32(color)));
}

/** `ColorMode::get_name()` per mode (`color_mode.h:72,94,118,148`). The first `MODE_BUTTON_COUNT` label `mode_btns`. */
export const COLOR_MODE_NAMES = ['RGB', 'HSV', 'Linear', 'OKHSL'] as const;

/** `MODE_BUTTON_COUNT` (`color_picker.h:184`). OKHSL has no mode button: only the dropdown reaches it. */
export const MODE_BUTTON_COUNT = 3;

/** `ColorMode::get_slider_step` (`color_mode.h:74,96,120,150`): 0.001 for Linear, 1 for every other mode. */
export function colorModeStep(mode: number): number {
  return mode === ColorPickerColorMode.MODE_LINEAR ? 0.001 : 1;
}

/** `ColorMode::get_allow_greater` (`color_mode.h:99,124`): only the RGB and Linear modes let a channel pass its max. */
export function colorModeAllowsGreater(mode: number): boolean {
  return mode === ColorPickerColorMode.MODE_RGB || mode === ColorPickerColorMode.MODE_LINEAR;
}

export interface ColorModeChannel {
  label: string;
  value: number;
  max: number;
}

/**
 * The 3 channel rows for `mode` (`color_mode.h`). A loaded node has had no edit, so `cached_hue`
 * and `cached_saturation` hold their default 0 (`color_mode.h:69-70,144-145`),
 * which the guards of `get_slider_value` fall back to.
 */
export function colorModeChannels(
  mode: number,
  color: Rgba
): [ColorModeChannel, ColorModeChannel, ColorModeChannel] {
  const normalized = colorNormalized(color);
  switch (mode) {
    case ColorPickerColorMode.MODE_HSV: {
      const { h, s, v } = extractHsv(normalized);
      return [
        { label: 'H', value: s > 0 ? h * 360 : 0, max: 359 },
        { label: 'S', value: v > 0 ? s * 100 : 0, max: 100 },
        { label: 'V', value: v * 100, max: 100 },
      ];
    }
    case ColorPickerColorMode.MODE_LINEAR: {
      const linear = sRGBColorToLinearF32(normalized);
      return [
        { label: 'R', value: linear.r, max: 1 },
        { label: 'G', value: linear.g, max: 1 },
        { label: 'B', value: linear.b, max: 1 },
      ];
    }
    case ColorPickerColorMode.MODE_OKHSL: {
      const { h, s, l } = srgbToOkhsl(normalized);
      return [
        { label: 'H', value: s > 0 ? h * 360 : 0, max: 359 },
        { label: 'S', value: l > 0 ? s * 100 : 0, max: 100 },
        { label: 'L', value: l * 100, max: 100 },
      ];
    }
    case ColorPickerColorMode.MODE_RGB:
    default:
      return [
        { label: 'R', value: normalized.r * 255, max: 255 },
        { label: 'G', value: normalized.g * 255, max: 255 },
        { label: 'B', value: normalized.b * 255, max: 255 },
      ];
  }
}

/** `ColorMode::get_alpha_slider_max/value` (`color_mode.h:51-52`). Linear overrides both (`:127-128`). */
export function colorModeAlphaChannel(mode: number, color: Rgba): ColorModeChannel {
  if (mode === ColorPickerColorMode.MODE_LINEAR) {
    return { label: 'A', value: color.a, max: 1 };
  }
  return { label: 'A', value: color.a * 255, max: 255 };
}

/** The fixed range of `SLIDER_INTENSITY` (`color_picker.cpp:2184-2186`) in every `color_mode`. */
export function colorModeIntensityChannel(color: Rgba): ColorModeChannel {
  return { label: 'I', value: colorIntensity(color), max: 10 };
}

/**
 * `ColorModeRGB/Linear::slider_draw`'s 2-stop gradient (`color_mode.cpp:91-98,
 * 289-296`): the channel sweeps 0 to 1 and the other two hold their `color_normalized`
 * value. Linear interpolates in `GRADIENT_COLOR_SPACE_LINEAR_SRGB` (`:311`), RGB in
 * `_SRGB` (`:113`).
 */
function rgbChannelGradientStops(channel: number, normalized: Rgba): [Rgba, Rgba] {
  const at = (v: number): Rgba => ({
    r: channel === 0 ? v : normalized.r,
    g: channel === 1 ? v : normalized.g,
    b: channel === 2 ? v : normalized.b,
    a: 1,
  });
  return [at(0), at(1)];
}

/**
 * `ColorModeHSV::slider_draw`'s S and V 2-stop polygon (`color_mode.cpp:196-206`).
 * Channel 0 (H) is the rainbow strip below.
 */
function hsvChannelGradientStops(channel: 1 | 2, normalized: Rgba): [Rgba, Rgba] {
  const { h, s, v } = extractHsv(normalized);
  if (channel === 1) {
    const sCol = hsvToRgb(h, 0, v);
    return [sCol, hsvToRgb(h, 1, v)];
  }
  return [{ r: 0, g: 0, b: 0, a: 1 }, hsvToRgb(h, s, 1)];
}

/**
 * `ColorModeHSV::slider_draw`'s H channel (`color_mode.cpp:218-221`): a flat grey `base` at
 * `color.get_v()`, then the 7-stop `color_hue` rainbow over it with a `Color::from_hsv(0, 0, v, s)`
 * modulate. At `s` = 0 the rainbow vanishes. One extraction serves both.
 */
function hsvHueChannelLayers(normalized: Rgba): { base: Rgba; stops: Rgba[] } {
  const { s, v } = extractHsv(normalized);
  return {
    base: { r: v, g: v, b: v, a: 1 },
    stops: COLOR_HUE_STOPS.map((c) => ({ r: c.r * v, g: c.g * v, b: c.b * v, a: s })),
  };
}

/**
 * `ColorModeOKHSL::slider_draw`'s S channel 2-stop polygon (`color_mode.cpp:
 * 412-427`), at the current `okhsl_l`.
 */
function okhslSaturationGradientStops(normalized: Rgba): [Rgba, Rgba] {
  const { h, l } = srgbToOkhsl(normalized);
  return [okhslToSrgb(h, 0, l), okhslToSrgb(h, 1, l)];
}

/**
 * `ColorModeOKHSL::slider_draw`'s L channel 3-stop polygon (`color_mode.cpp:
 * 392-411`): black, `from_ok_hsl(hue, sat, 0.5)` and `from_ok_hsl(hue, sat, 1)`,
 * as the stops at 0, 0.5 and 1.
 */
function okhslLightnessGradientStops(normalized: Rgba): [Rgba, Rgba, Rgba] {
  const { h, s } = srgbToOkhsl(normalized);
  return [{ r: 0, g: 0, b: 0, a: 1 }, okhslToSrgb(h, s, 0.5), okhslToSrgb(h, s, 1)];
}

/**
 * `ColorModeOKHSL::slider_draw`'s H channel (`color_mode.cpp:428-457`): 7 stops
 * like the default theme's `ColorPicker/color_hue`, sampled at the current saturation
 * and lightness, `from_ok_hsl(h, slider_sat, okhsl_l)`, and drawn opaque.
 */
function okhslHueChannelStops(normalized: Rgba): Rgba[] {
  const { s: sat, l } = srgbToOkhsl(normalized);
  const precision = 7;
  const stops: Rgba[] = [];
  for (let i = 0; i < precision; i++) {
    const h = i / (precision - 1);
    stops.push(okhslToSrgb(h, sat, l));
  }
  return stops;
}

/** `is_color_valid_hex` (`color_picker.cpp:60-62`): an overbright or negative channel cannot round-trip through `#RRGGBB`. */
function isColorValidHex(color: Pick<Rgba, 'r' | 'g' | 'b'>): boolean {
  return !isColorOverbright(color) && color.r >= 0 && color.g >= 0 && color.b >= 0;
}

/** `_append_hex` (`core/math/color.cpp:112-118`): `round(channel*255)` clamped to 0..255, as 2 lowercase hex digits. */
function appendHex(channel: number): string {
  const v = Math.min(255, Math.max(0, Math.round(channel * 255)));
  return v.toString(16).padStart(2, '0');
}

/** `Color::to_html` (`core/math/color.cpp:120-134`), without the `#`, which is the text of `text_type`. */
function toHtml(color: Rgba, withAlpha: boolean): string {
  const hex = appendHex(color.r) + appendHex(color.g) + appendHex(color.b);
  return withAlpha ? hex + appendHex(color.a) : hex;
}

interface HexFieldText {
  /** The text of `hex_label`: "Hex" or "Expr" (`color_picker.cpp:1442,1449`). */
  label: string;
  /** The text of `text_type`: "#" in hex mode, empty in expression mode, which shows an icon (`:1443,1450`). */
  typeText: string;
  /** The text of `c_text`. */
  text: string;
}

/**
 * `ColorPicker::_update_text_value` (`color_picker.cpp:1315-1335`). Only a button press sets
 * `text_is_constructor` (default `false`, `color_picker.h:263`), so `is_color_valid_hex`
 * decides: hex for an ordinary colour, `Color(r, g, b[, a])` for an HDR or negative one.
 */
export function hexFieldText(color: Rgba, editAlpha: boolean): HexFieldText {
  if (!isColorValidHex(color)) {
    const showAlpha = editAlpha && color.a < 1;
    const parts = [
      formatGodotNumber(color.r, 3),
      formatGodotNumber(color.g, 3),
      formatGodotNumber(color.b, 3),
    ];
    if (showAlpha) parts.push(formatGodotNumber(color.a, 3));
    return { label: 'Expr', typeText: '', text: `Color(${parts.join(', ')})` };
  }
  const withAlpha = editAlpha && color.a < 1;
  return { label: 'Hex', typeText: '#', text: toHtml(color, withAlpha) };
}

/**
 * `ColorPicker::_alpha_slider_draw`'s 2-stop gradient (`color_picker.cpp:
 * 1423-1450`): `color_normalized` from alpha 0 to alpha 1. Its gate `colorize_sliders`
 * defaults to `true` (`color_picker.h:266`) and has no serialised property.
 */
function alphaChannelGradientStops(normalized: Rgba): [Rgba, Rgba] {
  return [
    { ...normalized, a: 0 },
    { ...normalized, a: 1 },
  ];
}

/** What a channel slider's `draw` callback draws over its top `16 * base_scale` pixels. */
export type ChannelGradient =
  | {
      /** Drawn with `draw_polygon`: these colours evenly spaced from left to right. */
      stops: readonly Rgba[];
      /**
       * Drawn under the stops: the alpha row's `sample_bg` tiles (`color_picker.cpp:1434`), or the HSV
       * H row's grey polygon, over which the hue texture is modulated (`color_mode.cpp:218-221`).
       */
      underlay: 'checkerboard' | { grey: Rgba } | null;
    }
  | {
      /** Drawn with `draw_texture_rect` from a gradient texture of this size. */
      texture: GradientTexture2D;
      gradient: Gradient;
    };

/**
 * The texture of an RGB, Linear and OKHSL H row: `set_width(400)` (`color_mode.cpp:102,302,432`).
 * Every row of a texture holds the same texels, so one row stands for the RGB rows' 6 and the
 * OKHSL row's `GradientTexture1D`.
 */
const CHANNEL_TEXTURE: GradientTexture2D = {
  width: 400,
  height: 1,
  fill: GradientTexture2DFill.LINEAR,
  fillFrom: { x: 0, y: 0 },
  fillTo: { x: 1, y: 0 },
  repeat: GradientTexture2DRepeat.NONE,
  useHdr: false,
};

const polygon = (
  stops: readonly Rgba[],
  underlay: 'checkerboard' | { grey: Rgba } | null = null
): ChannelGradient => ({
  stops,
  underlay,
});

/** A row's texture: its stops evenly spaced in a linear `Gradient` that blends in `space`. */
function texture(stops: readonly Rgba[], space: Gradient['interpolationColorSpace']): ChannelGradient {
  const gradient: Gradient = {
    stops: stops.map((color, i) => ({ offset: Math.fround(i / (stops.length - 1)), color })),
    interpolationMode: GradientInterpolationMode.LINEAR,
    interpolationColorSpace: space,
  };
  return { texture: CHANNEL_TEXTURE, gradient };
}

/** `ColorMode::slider_draw` of `mode` for the channel row `channel`, 0 to 2 (`color_mode.cpp`). */
export function channelGradient(mode: number, channel: 0 | 1 | 2, normalized: Rgba): ChannelGradient {
  switch (mode) {
    case ColorPickerColorMode.MODE_HSV: {
      if (channel !== 0) return polygon(hsvChannelGradientStops(channel, normalized));
      const hue = hsvHueChannelLayers(normalized);
      return polygon(hue.stops, { grey: hue.base });
    }
    case ColorPickerColorMode.MODE_OKHSL:
      if (channel === 0) return texture(okhslHueChannelStops(normalized), GradientColorSpace.OKLAB);
      if (channel === 1) return polygon(okhslSaturationGradientStops(normalized));
      return polygon(okhslLightnessGradientStops(normalized));
    case ColorPickerColorMode.MODE_LINEAR:
      return texture(rgbChannelGradientStops(channel, normalized), GradientColorSpace.LINEAR_SRGB);
    default:
      return texture(rgbChannelGradientStops(channel, normalized), GradientColorSpace.SRGB);
  }
}

/** `_alpha_slider_draw` (`color_picker.cpp:1423-1450`): the colour from alpha 0 to 1 over `sample_bg`. */
export function alphaGradient(normalized: Rgba): ChannelGradient {
  return polygon(alphaChannelGradientStops(normalized), 'checkerboard');
}
