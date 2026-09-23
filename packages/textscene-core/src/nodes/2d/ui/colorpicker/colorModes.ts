/**
 * `ColorMode` (`scene/gui/color_mode.h`/`.cpp`): the channel set of each
 * `color_mode`, which the slider grid and the hex field read.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import type { ControlColor } from '../control/types';
import { isColorOverbright } from '../shared/colorOverbright';
import { formatGodotNumber } from '../spinbox/nativeSolver';
import { extractHsv, hsvToRgb } from './nativeSolver';
import { okhslToSrgb, srgbToOkhsl } from './okhsl';

/** `ColorModeType` (`color_picker.h`). `MODE_RAW` is a deprecated alias with the value of `MODE_LINEAR` (`:105-107`). */
export const MODE_RGB = 0;
export const MODE_HSV = 1;
export const MODE_LINEAR = 2;
export const MODE_OKHSL = 3;

/**
 * `_copy_color_to_normalized_and_intensity` (`color_picker.cpp:593-602`):
 * every slider value and gradient stop reads `color_normalized`, not the raw
 * `color`. Only rgb is normalised: `ColorMode::get_alpha_slider_value` reads
 * `get_pick_color()`, so alpha passes through unchanged.
 */
export function colorNormalized(color: ControlColor): ControlColor {
  const linear = {
    r: sRGBChannelToLinear(color.r),
    g: sRGBChannelToLinear(color.g),
    b: sRGBChannelToLinear(color.b),
  };
  const multiplier = Math.max(1, linear.r, linear.g, linear.b);
  return {
    r: linearChannelToSRGB(linear.r / multiplier),
    g: linearChannelToSRGB(linear.g / multiplier),
    b: linearChannelToSRGB(linear.b / multiplier),
    a: color.a,
  };
}

/** `Color::linear_to_srgb` (`core/math/color.h:199-204`). */
function linearChannelToSRGB(c: number): number {
  if (c < 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** `intensity = Math::log2(multiplier)` (`color_picker.cpp:594,601`): the intensity slider's value in every `color_mode`. */
export function colorIntensity(color: ControlColor): number {
  const linear = {
    r: sRGBChannelToLinear(color.r),
    g: sRGBChannelToLinear(color.g),
    b: sRGBChannelToLinear(color.b),
  };
  const multiplier = Math.max(1, linear.r, linear.g, linear.b);
  return Math.log2(multiplier);
}

/** `ColorMode::labels` per mode (`color_mode.h:67,91,114,142`). */
const CHANNEL_LABELS: Readonly<Record<number, readonly [string, string, string]>> = {
  [MODE_RGB]: ['R', 'G', 'B'],
  [MODE_HSV]: ['H', 'S', 'V'],
  [MODE_LINEAR]: ['R', 'G', 'B'],
  [MODE_OKHSL]: ['H', 'S', 'L'],
};

/**
 * The row order of `slider_gc` (`color_picker.cpp:2178-2189`, `color_picker.h:153-159`):
 * the 3 channel rows, then intensity, then alpha. `_update_controls` hides a
 * row and never reorders them.
 */
export function colorPickerSliderLabels(mode: number, editAlpha: boolean, editIntensity: boolean): string[] {
  const labels: string[] = [...(CHANNEL_LABELS[mode] ?? CHANNEL_LABELS[MODE_RGB]!)];
  if (editIntensity) labels.push('I');
  if (editAlpha) labels.push('A');
  return labels;
}

export interface ColorModeChannel {
  label: string;
  value: number;
  max: number;
  /** `Math::range_step_decimals(step)` (`color_picker.cpp:716`): 0 for step 1 and 3 for step 0.001, the only two steps. */
  decimals: number;
}

/**
 * The 3 channel rows for `mode` (`color_mode.h`). A loaded node has had no edit, so `cached_hue`
 * and `cached_saturation` hold their default 0 (`color_mode.h:69-70,144-145`),
 * which the guards of `get_slider_value` fall back to.
 */
export function colorModeChannels(mode: number, color: ControlColor): [ColorModeChannel, ColorModeChannel, ColorModeChannel] {
  const normalized = colorNormalized(color);
  switch (mode) {
    case MODE_HSV: {
      const { h, s, v } = extractHsv(normalized);
      return [
        { label: 'H', value: s > 0 ? h * 360 : 0, max: 359, decimals: 0 },
        { label: 'S', value: v > 0 ? s * 100 : 0, max: 100, decimals: 0 },
        { label: 'V', value: v * 100, max: 100, decimals: 0 },
      ];
    }
    case MODE_LINEAR: {
      const linear = {
        r: sRGBChannelToLinear(normalized.r),
        g: sRGBChannelToLinear(normalized.g),
        b: sRGBChannelToLinear(normalized.b),
      };
      return [
        { label: 'R', value: linear.r, max: 1, decimals: 3 },
        { label: 'G', value: linear.g, max: 1, decimals: 3 },
        { label: 'B', value: linear.b, max: 1, decimals: 3 },
      ];
    }
    case MODE_OKHSL: {
      const { h, s, l } = srgbToOkhsl(normalized);
      return [
        { label: 'H', value: s > 0 ? h * 360 : 0, max: 359, decimals: 0 },
        { label: 'S', value: l > 0 ? s * 100 : 0, max: 100, decimals: 0 },
        { label: 'L', value: l * 100, max: 100, decimals: 0 },
      ];
    }
    case MODE_RGB:
    default:
      return [
        { label: 'R', value: normalized.r * 255, max: 255, decimals: 0 },
        { label: 'G', value: normalized.g * 255, max: 255, decimals: 0 },
        { label: 'B', value: normalized.b * 255, max: 255, decimals: 0 },
      ];
  }
}

/** `ColorMode::get_alpha_slider_max/value` (`color_mode.h:51-52`). Linear overrides both (`:127-128`). */
export function colorModeAlphaChannel(mode: number, color: ControlColor): ColorModeChannel {
  if (mode === MODE_LINEAR) {
    return { label: 'A', value: color.a, max: 1, decimals: 3 };
  }
  return { label: 'A', value: color.a * 255, max: 255, decimals: 0 };
}

/** The fixed range of `SLIDER_INTENSITY` (`color_picker.cpp:2184-2186`) in every `color_mode`. */
export function colorModeIntensityChannel(color: ControlColor): ColorModeChannel {
  return { label: 'I', value: colorIntensity(color), max: 10, decimals: 3 };
}

/**
 * `String::num(value, decimals)` (`core/string/ustring.cpp:1405-1481`), which formats
 * every value `SpinBox` and the `Color(...)` text of `color_to_string` (`color_picker.cpp:64-73`).
 * The caller adds the `+` prefix of `intensity_value` (`color_picker.cpp:729`).
 */
export function formatSliderValue(value: number, decimals: number): string {
  return formatGodotNumber(value, decimals);
}

/**
 * `ColorModeRGB/Linear::slider_draw`'s 2-stop gradient (`color_mode.cpp:91-98,
 * 289-296`): the channel sweeps 0 to 1 and the other two hold their `color_normalized`
 * value. Linear interpolates in `GRADIENT_COLOR_SPACE_LINEAR_SRGB` (`:311`), RGB in
 * `_SRGB` (`:113`). The caller linearises the Linear stops.
 */
export function rgbChannelGradientStops(channel: number, normalized: ControlColor): [ControlColor, ControlColor] {
  const at = (v: number): ControlColor => ({
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
export function hsvChannelGradientStops(channel: 1 | 2, normalized: ControlColor): [ControlColor, ControlColor] {
  const { h, s, v } = extractHsv(normalized);
  if (channel === 1) {
    const sCol = hsvToRgb(h, 0, v);
    return [sCol, hsvToRgb(h, 1, v)];
  }
  return [{ r: 0, g: 0, b: 0, a: 1 }, hsvToRgb(h, s, 1)];
}

/**
 * `ColorModeHSV::slider_draw`'s H channel (`color_mode.cpp:218-221`): a flat
 * grey base at `color.get_v()`, then the 7-stop `color_hue` rainbow over it with
 * a `Color::from_hsv(0, 0, v, s)` modulate. This is the base, and the overlay
 * alpha is `hsvHueChannelOverlayAlpha`.
 */
export function hsvHueChannelBase(normalized: ControlColor): ControlColor {
  const { v } = extractHsv(normalized);
  return { r: v, g: v, b: v, a: 1 };
}

export function hsvHueChannelOverlayAlpha(normalized: ControlColor): number {
  return extractHsv(normalized).s;
}

/**
 * `ColorModeOKHSL::slider_draw`'s S channel 2-stop polygon (`color_mode.cpp:
 * 412-427`), at the current `okhsl_l`.
 */
export function okhslSaturationGradientStops(normalized: ControlColor): [ControlColor, ControlColor] {
  const { h, l } = srgbToOkhsl(normalized);
  return [okhslToSrgb(h, 0, l), okhslToSrgb(h, 1, l)];
}

/**
 * `ColorModeOKHSL::slider_draw`'s L channel 3-stop polygon (`color_mode.cpp:
 * 392-411`): black, `from_ok_hsl(hue, sat, 0.5)` and `from_ok_hsl(hue, sat, 1)`,
 * as the stops at 0, 0.5 and 1.
 */
export function okhslLightnessGradientStops(normalized: ControlColor): [ControlColor, ControlColor, ControlColor] {
  const { h, s } = srgbToOkhsl(normalized);
  return [{ r: 0, g: 0, b: 0, a: 1 }, okhslToSrgb(h, s, 0.5), okhslToSrgb(h, s, 1)];
}

/**
 * `ColorModeOKHSL::slider_draw`'s H channel (`color_mode.cpp:428-457`): 7 stops
 * like the `color_hue` of `default_theme.cpp`, sampled at the current saturation
 * and lightness, `from_ok_hsl(h, slider_sat, okhsl_l)`, and drawn opaque.
 */
export function okhslHueChannelStops(normalized: ControlColor): ControlColor[] {
  const { s: sat, l } = srgbToOkhsl(normalized);
  const precision = 7;
  const stops: ControlColor[] = [];
  for (let i = 0; i < precision; i++) {
    const h = i / (precision - 1);
    stops.push(okhslToSrgb(h, sat, l));
  }
  return stops;
}

/** `is_color_valid_hex` (`color_picker.cpp:60-62`): an overbright or negative channel cannot round-trip through `#RRGGBB`. */
function isColorValidHex(color: Pick<ControlColor, 'r' | 'g' | 'b'>): boolean {
  return !isColorOverbright(color) && color.r >= 0 && color.g >= 0 && color.b >= 0;
}

/** `_append_hex` (`core/math/color.cpp:112-118`): `round(channel*255)` clamped to 0..255, as 2 lowercase hex digits. */
function appendHex(channel: number): string {
  const v = Math.min(255, Math.max(0, Math.round(channel * 255)));
  return v.toString(16).padStart(2, '0');
}

/** `Color::to_html` (`core/math/color.cpp:120-134`), without the `#`, which is the text of `text_type`. */
function toHtml(color: ControlColor, withAlpha: boolean): string {
  const hex = appendHex(color.r) + appendHex(color.g) + appendHex(color.b);
  return withAlpha ? hex + appendHex(color.a) : hex;
}

export interface HexFieldText {
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
export function hexFieldText(color: ControlColor, editAlpha: boolean): HexFieldText {
  if (!isColorValidHex(color)) {
    const showAlpha = editAlpha && color.a < 1;
    const parts = [formatSliderValue(color.r, 3), formatSliderValue(color.g, 3), formatSliderValue(color.b, 3)];
    if (showAlpha) parts.push(formatSliderValue(color.a, 3));
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
export function alphaChannelGradientStops(normalized: ControlColor): [ControlColor, ControlColor] {
  return [{ ...normalized, a: 0 }, { ...normalized, a: 1 }];
}
