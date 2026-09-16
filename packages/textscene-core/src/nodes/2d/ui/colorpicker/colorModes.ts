/**
 * `ColorMode` (`scene/gui/color_mode.h`/`.cpp`) — the per-`color_mode` channel
 * set the slider grid and hex field both read. Pure data + functions (no
 * React/THREE), matching `nativeSolver.ts`'s own convention.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import type { ControlColor } from '../control/types';
import { isColorOverbright } from '../shared/colorOverbright';
import { extractHsv, hsvToRgb } from './nativeSolver';
import { okhslToSrgb, srgbToOkhsl } from './okhsl';

/** `ColorModeType` (`color_picker.h`'s enum) — `MODE_RAW` is a deprecated alias for `MODE_LINEAR` (`:105-107`), same value. */
export const MODE_RGB = 0;
export const MODE_HSV = 1;
export const MODE_LINEAR = 2;
export const MODE_OKHSL = 3;

/**
 * `_copy_color_to_normalized_and_intensity` (`color_picker.cpp:593-602`):
 * every slider value and gradient stop reads `color_normalized`, never the
 * raw `color`, for any channel but alpha (`ColorMode::get_alpha_slider_value`'s
 * own default reads `get_pick_color()` directly). Alpha itself passes
 * through unchanged — only rgb is normalised.
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

/** `Color::linear_to_srgb` (`core/math/color.h:199-204`) — duplicated from `nativeSolver.ts`'s private copy since that module cannot export it without becoming this module's own dependency inverted. */
function linearChannelToSRGB(c: number): number {
  if (c < 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** `intensity = Math::log2(multiplier)` (`color_picker.cpp:594,601`) — the intensity slider's own value, independent of `color_mode`. */
export function colorIntensity(color: ControlColor): number {
  const linear = {
    r: sRGBChannelToLinear(color.r),
    g: sRGBChannelToLinear(color.g),
    b: sRGBChannelToLinear(color.b),
  };
  const multiplier = Math.max(1, linear.r, linear.g, linear.b);
  return Math.log2(multiplier);
}

/** `ColorMode::labels` per mode (`color_mode.h:67,91,114,142`) — fixed per mode, independent of the current colour. */
const CHANNEL_LABELS: Readonly<Record<number, readonly [string, string, string]>> = {
  [MODE_RGB]: ['R', 'G', 'B'],
  [MODE_HSV]: ['H', 'S', 'V'],
  [MODE_LINEAR]: ['R', 'G', 'B'],
  [MODE_OKHSL]: ['H', 'S', 'L'],
};

/**
 * `slider_gc`'s own row order (`color_picker.cpp:2178-2189`, `create_slider`'s
 * loop over `SLIDER_MAX`; `SLIDER_INTENSITY = MODE_SLIDER_COUNT`,
 * `SLIDER_ALPHA = SLIDER_INTENSITY + 1`, `color_picker.h:153-159`): the 3
 * channel rows for `mode`, THEN intensity (if `edit_intensity`), THEN alpha
 * (if `edit_alpha`) — intensity always precedes alpha when both show, and
 * neither ever precedes a channel row. `_update_controls` only ever hides a
 * row, never reorders `slider_gc`'s children.
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
  /** `Math::range_step_decimals(step)` (`color_picker.cpp:716`) — `step_decimals(1)=0`, `step_decimals(0.001)=3`, the only two steps any mode uses. */
  decimals: number;
}

/**
 * The 3 channel rows `slider_gc` shows for `mode` (`color_mode.h`'s
 * `labels`/`slider_max`, `get_slider_value` overrides) — a freshly-loaded
 * `.tscn` node has never had an interactive edit, so `cached_hue`/
 * `cached_saturation` are always their construction default, 0
 * (`color_mode.h:69-70,144-145`), and the `s>0`/`v>0`/`l` guards in
 * `ColorModeHSV`/`ColorModeOKHSL::get_slider_value` read off that.
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

/** `ColorMode::get_alpha_slider_max/value` — the base default (`color_mode.h:51-52`) for every mode but Linear, which overrides both (`:127-128`). */
export function colorModeAlphaChannel(mode: number, color: ControlColor): ColorModeChannel {
  if (mode === MODE_LINEAR) {
    return { label: 'A', value: color.a, max: 1, decimals: 3 };
  }
  return { label: 'A', value: color.a * 255, max: 255, decimals: 0 };
}

/** `SLIDER_INTENSITY`'s own fixed range (`color_picker.cpp:2184-2186`) — the same widget for every `color_mode`. */
export function colorModeIntensityChannel(color: ControlColor): ColorModeChannel {
  return { label: 'I', value: colorIntensity(color), max: 10, decimals: 3 };
}

/**
 * `String::num(value, decimals)` (`core/string/ustring.cpp:1405-...`) —
 * fixed-decimal formatting, `decimals=0` producing no trailing point.
 * `intensity_value->set_prefix(intensity < 0 ? "" : "+")`
 * (`color_picker.cpp:729`) is the caller's job, not this function's.
 */
export function formatSliderValue(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

/**
 * `ColorModeRGB/Linear::slider_draw`'s 2-stop gradient (`color_mode.cpp:91-98,
 * 289-296`) — the channel sweeps 0..1 (RGB) / 0..1 in linear space (Linear),
 * the other two channels held at `color_normalized`'s own value. RGB and
 * Linear share this shape; Linear's own `GRADIENT_COLOR_SPACE_LINEAR_SRGB`
 * interpolation (`:311`, vs. RGB's `_SRGB`, `:113`) is NOT reproduced — this
 * previewer's gradient mesh always interpolates in sRGB space
 * (`Component.tsx`'s own shader injection), a visible difference only in the
 * gradient's INTERIOR, never at its endpoints.
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
 * `ColorModeHSV::slider_draw`'s S/V 2-stop polygon (`color_mode.cpp:196-206`)
 * — channel 1 (S) and channel 2 (V) only; channel 0 (H) is the rainbow strip
 * (`hsvHueChannelStops`/`hsvHueChannelAlpha` below).
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
 * grey base at `color.get_v()` (drawn first, `slider_draw`'s own
 * `draw_polygon`), then the theme's 7-stop `color_hue` rainbow texture drawn
 * OVER it with a `Color::from_hsv(0, 0, v, s)` modulate — opaque grey (alpha
 * 1) at `s=0`, full rainbow (alpha 1) at `s=1`. The base colour and the
 * overlay's uniform alpha are exposed separately; `hueStripGeometry`
 * (`svGradient.ts`) already builds the 7-stop rainbow itself.
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
 * 412-427`), at the CURRENT `okhsl_l`.
 */
export function okhslSaturationGradientStops(normalized: ControlColor): [ControlColor, ControlColor] {
  const { h, l } = srgbToOkhsl(normalized);
  return [okhslToSrgb(h, 0, l), okhslToSrgb(h, 1, l)];
}

/**
 * `ColorModeOKHSL::slider_draw`'s L channel 3-stop polygon (`color_mode.cpp:
 * 392-411`): black, `from_ok_hsl(hue, sat, 0.5)`, `from_ok_hsl(hue, sat, 1)`
 * — returned as the 3 stops of a 2-segment strip (0, 0.5, 1).
 */
export function okhslLightnessGradientStops(normalized: ControlColor): [ControlColor, ControlColor, ControlColor] {
  const { h, s } = srgbToOkhsl(normalized);
  return [{ r: 0, g: 0, b: 0, a: 1 }, okhslToSrgb(h, s, 0.5), okhslToSrgb(h, s, 1)];
}

/**
 * `ColorModeOKHSL::slider_draw`'s H channel (`color_mode.cpp:428-457`): the
 * SAME 7-stop-precision texture pattern as `default_theme.cpp`'s
 * `color_hue`, but resampled per-draw at the CURRENT saturation/lightness
 * (`from_ok_hsl(h, slider_sat, okhsl_l)`) rather than a fixed `s=1,v=1`
 * sweep, and drawn with no modulate (fully opaque).
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

/** `is_color_valid_hex` (`color_picker.cpp:60-62`) — overbright or a negative channel cannot round-trip through `#RRGGBB`. */
function isColorValidHex(color: Pick<ControlColor, 'r' | 'g' | 'b'>): boolean {
  return !isColorOverbright(color) && color.r >= 0 && color.g >= 0 && color.b >= 0;
}

/** `_append_hex` (`core/math/color.cpp:112-118`) — `round(channel*255)` clamped 0..255, 2 lowercase hex digits. */
function appendHex(channel: number): string {
  const v = Math.min(255, Math.max(0, Math.round(channel * 255)));
  return v.toString(16).padStart(2, '0');
}

/** `Color::to_html` (`core/math/color.cpp:120-134`) — no leading `#`, that is `text_type`'s own button text. */
function toHtml(color: ControlColor, withAlpha: boolean): string {
  const hex = appendHex(color.r) + appendHex(color.g) + appendHex(color.b);
  return withAlpha ? hex + appendHex(color.a) : hex;
}

export interface HexFieldText {
  /** `hex_label`'s own text — "Hex" or "Expr" (`color_picker.cpp:1442,1449`). */
  label: string;
  /** `text_type`'s own button text — "#" in hex mode, "" (an icon instead) in expression mode (`:1443,1450`). */
  typeText: string;
  /** `c_text`'s own contents. */
  text: string;
}

/**
 * `ColorPicker::_update_text_value` (`color_picker.cpp:1315-1335`) — a freshly
 * loaded `.tscn` node has never toggled `text_type` (`text_is_constructor`
 * starts `false`, `color_picker.h:263`, and only `_text_type_toggled`'s own
 * button press ever flips it), so the branch is decided purely by
 * `is_color_valid_hex`: hex spelling for an ordinary colour, the
 * `Color(r, g, b[, a])` constructor spelling for an HDR/negative one.
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
 * 1423-1450`) — `color_normalized` at alpha 0 fading to alpha 1. Gated on
 * `colorize_sliders` there, which defaults `true` (`color_picker.h:266`) and
 * carries no serialised property (no `ADD_PROPERTY`/validator), so every
 * `.tscn`-loaded node draws it.
 */
export function alphaChannelGradientStops(normalized: ControlColor): [ControlColor, ControlColor] {
  return [{ ...normalized, a: 0 }, { ...normalized, a: 1 }];
}
