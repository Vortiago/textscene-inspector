/**
 * Shared HSlider/VSlider native geometry: `Slider::get_minimum_size` and
 * `Slider::_notification(NOTIFICATION_DRAW)` (`scene/gui/slider.cpp`, Godot 4.6.3), transposed for
 * `vertical`. Each slice supplies only its icon and `vertical` flag.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../godot/math/rect2';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { scaledIconSize } from '../../../../r3f/controls/native/scaledSvgIcon';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { rangeRatio, type RangeProperties, type RangeValueOrder } from './range';
import type { Vector2 } from '../../../../godot/math/vector';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';

/** A slider's two boxes: the track (`slider`) and the filled part before the grabber (`grabber_area`). */
export interface SliderBoxes {
  slider: StyleBoxFlatData;
  grabberArea: StyleBoxFlatData;
}

export function sliderBoxes(styleBoxes: SolveNode['styleBoxes']): SliderBoxes {
  return {
    slider: requiredThemeItem(styleBoxes, 'slider'),
    grabberArea: requiredThemeItem(styleBoxes, 'grabber_area'),
  };
}

/**
 * `tick.svg`'s cross-axis extent. `pnpm ref:godot` paints an 8px band at `default_theme_scale = 1`,
 * the declared canvas of `hslider_tick.svg`/`vslider_tick.svg` (`width="4" height="8"`/`width="8"
 * height="4"`): the path draws to `y="16"`/`x="16"`, but the rasteriser clips to the canvas. The
 * default theme rasterises the canvas at `default_theme_scale`.
 */
const SLIDER_TICK_CROSS_AXIS = 8;

/** `Size2i`'s cast: each axis truncated toward zero. */
const size2i = (size: Vector2): Vector2 => ({ x: Math.trunc(size.x), y: Math.trunc(size.y) });

/** `Size2i ss = slider_style->get_minimum_size()` (`slider.cpp:36`): the `slider` box's margins, each axis summed, then truncated. */
function sliderStyleSize(slider: StyleBoxFlatData): Vector2 {
  return size2i(contentMarginSize(slider));
}

/**
 * The track's cross-axis thickness, `widget_width` or `widget_height` (`slider.cpp:296,328`): the `slider`
 * box's minimum size on that axis, so the sum of two rounded margins.
 */
function trackThickness(vertical: boolean, slider: StyleBoxFlatData): number {
  const size = sliderStyleSize(slider);
  return vertical ? size.x : size.y;
}

/**
 * `Slider::get_minimum_size()` (`slider.cpp:35-44`): `Size2i(ss.width, MAX(ss.height, rs.height))`
 * horizontally, `ss` the `slider` style and `rs` the `grabber` icon. A themed `grabber` need not be
 * square, so it is a `Vector2`.
 */
export function sliderMinimumSize(vertical: boolean, slider: StyleBoxFlatData, grabber: Vector2): Vector2 {
  const ss = sliderStyleSize(slider);
  return vertical ? { x: Math.max(ss.x, grabber.x), y: ss.y } : { x: ss.x, y: Math.max(ss.y, grabber.y) };
}

/**
 * `grabber_icon` (`BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_ICON, Slider, grabber_icon, "grabber")`,
 * `slider.cpp:480`), the one icon the geometry reads. `grabber_highlight`, `grabber_disabled` and
 * `grabber_area_highlight` are interactive states a still frame never shows. Unthemed, it is the
 * vendored square, `theme.sliderGrabberSize` on both axes.
 */
export function sliderGrabberIconSize(
  theme: NativeTheme,
  textureSlots: Readonly<Record<string, Vector2 | null>>
): Vector2 {
  return textureSlots.grabber ?? { x: theme.sliderGrabberSize, y: theme.sliderGrabberSize };
}

/** What the draw reads of the grabber: its icon's size and the `center_grabber` and `grabber_offset` constants. */
export interface SliderGrabber {
  size: Vector2;
  /** `center_grabber` (`slider.cpp:485`): the grabber centres on the value and the travel spans the whole track. */
  isCentred: boolean;
  /** `grabber_offset` (`slider.cpp:486`): the grabber's shift across the track, in pixels. */
  offsetPx: number;
}

/** The grabber of `n`, from its theme items and the size `sliderGrabberIconSize` gives its icon. */
export function sliderGrabber(
  theme: NativeTheme,
  n: Pick<SolveNode, 'textureSlots' | 'constants'>
): SliderGrabber {
  return {
    size: sliderGrabberIconSize(theme, n.textureSlots),
    isCentred: requiredThemeItem(n.constants, 'center_grabber') !== 0,
    offsetPx: requiredThemeItem(n.constants, 'grabber_offset'),
  };
}

/** `tick_offset` (`slider.cpp:487`): the ticks' shift across the track, in pixels. */
export function sliderTickOffset(n: Pick<SolveNode, 'constants'>): number {
  return requiredThemeItem(n.constants, 'tick_offset');
}

/**
 * The travel the ratio spans, `areasize`, and the grabber's shift along it, `grabber_shift`
 * (`slider.cpp:299-300,329-330`). A centred grabber travels the whole track and shifts back by half.
 */
function grabberTravel(vertical: boolean, size: Vector2, grabber: SliderGrabber) {
  const along = vertical ? grabber.size.y : grabber.size.x;
  const half = Math.trunc(along / 2);
  const length = vertical ? size.y : size.x;
  if (!grabber.isCentred) return { along, half, areasize: length - along, shift: 0 };
  // The vertical arm measures up from the bottom, so its shift has the other sign.
  return { along, half, areasize: length, shift: vertical ? half : -half };
}

/**
 * `Slider::_notification(NOTIFICATION_DRAW)`'s `double ratio = Math::is_nan(get_as_ratio()) ? 0 :
 * get_as_ratio();`. `rangeRatio` (`shared/range.ts`) is `Range::get_as_ratio()` with its degenerate
 * guard, and this adds Slider's guard for a literal NaN. `orderedKeys` feeds the file-order value
 * resolution (`resolveRangeValue`, ADR-0035), and `undefined` assumes editor save order.
 */
export function resolveSliderRatio(props: RangeProperties, orderedKeys?: RangeValueOrder): number {
  const ratio = rangeRatio(props, orderedKeys);
  return Number.isNaN(ratio) ? 0 : ratio;
}

/**
 * The `slider` StyleBox draw rect (`slider.cpp:333` horizontal, `slider.cpp:301` vertical), centred
 * at `(size.height - widget_height) / 2`. The vertical arm truncates `size.width / 2` and
 * `widget_width / 2` separately, as the C++ does.
 */
export function sliderTrackRect(vertical: boolean, rawSize: Vector2, slider: StyleBoxFlatData): Rect2 {
  const size = size2i(rawSize);
  const thickness = trackThickness(vertical, slider);
  if (vertical) {
    return { x: Math.trunc(size.x / 2) - Math.trunc(thickness / 2), y: 0, w: thickness, h: size.y };
  }
  return { x: 0, y: Math.trunc((size.y - thickness) / 2), w: size.x, h: thickness };
}

/**
 * The `grabber_area` fill rect (`slider.cpp:299,302` vertical, `slider.cpp:329-339` horizontal).
 * The horizontal arm truncates through `int p`, and the vertical arm calls `Math::round` on its
 * origin and size, as Godot does. `rtl` reverses the ratio before the truncation, so the RTL
 * rect is not the LTR rect mirrored.
 */
export function sliderGrabberAreaRect(
  vertical: boolean,
  rawSize: Vector2,
  ratio: number,
  slider: StyleBoxFlatData,
  grabber: SliderGrabber,
  /**
   * `Control::is_layout_rtl()`, which the vertical arm lacks. The draw branch (`:331`) reaches only
   * this fill and the grabber: the track (`:333`) spans the width and the tick loop (`:341-359`) is
   * symmetric. The `gui_input` arms (`slider.cpp:77,116,144,160,216,224`) are not ported.
   */
  rtl: boolean
): Rect2 {
  const size = size2i(rawSize);
  const thickness = trackThickness(vertical, slider);
  // `grabber->get_width() / 2` is an integer division (`slider.cpp:302,334`): an odd grabber
  // contributes the floor, not the half.
  const { half, areasize, shift } = grabberTravel(vertical, size, grabber);
  if (vertical) {
    const x = Math.trunc((size.x - thickness) / 2);
    const y = Math.round(size.y - areasize * ratio - half + shift);
    const h = Math.round(areasize * ratio + half - shift);
    return { x, y, w: thickness, h };
  }
  const p = Math.trunc(areasize * (rtl ? 1 - ratio : ratio) + half + shift);
  const y = Math.trunc((size.y - thickness) / 2);
  return rtl ? { x: p, y, w: size.x - p, h: thickness } : { x: 0, y, w: p, h: thickness };
}

/**
 * The `grabber` icon box (`slider.cpp:326` vertical, `slider.cpp:363` horizontal): the top-left where
 * `Texture2D::draw` puts the texture at its natural size, shifted across the track by `grabber_offset`.
 */
export function sliderGrabberRect(
  vertical: boolean,
  rawSize: Vector2,
  ratio: number,
  grabber: SliderGrabber,
  /** `Control::is_layout_rtl()`, which the vertical arm lacks. */
  rtl: boolean
): Rect2 {
  const size = size2i(rawSize);
  const { along, areasize, shift } = grabberTravel(vertical, size, grabber);
  const { x: w, y: h } = grabber.size;
  if (vertical) {
    const x = Math.trunc(size.x / 2) - Math.trunc(w / 2) + grabber.offsetPx;
    const y = Math.trunc(size.y - ratio * areasize - along + shift);
    return { x, y, w, h };
  }
  const x = Math.trunc((rtl ? 1 - ratio : ratio) * areasize + shift);
  // Two separate integer divisions (`slider.cpp:363`), as the vertical branch above.
  const y = Math.trunc(size.y / 2) - Math.trunc(h / 2) + grabber.offsetPx;
  return { x, y, w, h };
}

/**
 * One rect per painted tick index from `sliderTickIndices`, at `TICK_POSITION_BOTTOM_RIGHT`
 * (`slider.cpp:342-347` horizontal, `slider.cpp:304-311` vertical), since `shared/slider.ts` does
 * not parse `ticks_position`. Ticks march across the grabber travel, not the visible track, and
 * divide by the configured `tickCount - 1`, as `sliderChrome.ts`'s `divisions` does.
 */
export function sliderTickRects(
  vertical: boolean,
  rawSize: Vector2,
  indices: readonly number[],
  tickCount: number,
  theme: NativeTheme,
  grabber: SliderGrabber,
  slider: StyleBoxFlatData,
  tickOffsetPx: number
): Rect2[] {
  const size = size2i(rawSize);
  const thickness = trackThickness(vertical, slider);
  // The 4px along-axis box of `hslider_tick.svg`/`vslider_tick.svg`, scaled by `default_theme_scale`.
  const along = theme.sliderTickBox;
  const cross = scaledIconSize(SLIDER_TICK_CROSS_AXIS, theme.scale);
  const divisions = tickCount - 1;
  const { half, areasize, shift } = grabberTravel(vertical, size, grabber);
  // `grabber.width/2 - tick.width/2` horizontally and `grabber.height/2 - tick.height/2` vertically
  // (`slider.cpp:305,342`). The vertical arm subtracts the shift (`:310`), the horizontal adds it (`:347`).
  const tickShift = half - Math.trunc(along / 2) + (vertical ? -shift : shift);
  const across =
    Math.trunc(thickness + (vertical ? size.x - thickness : size.y - thickness) / 2) + tickOffsetPx;
  return indices.map((i) => {
    const ofs = Math.trunc((i * areasize) / divisions + tickShift);
    return vertical ? { x: across, y: ofs, w: cross, h: along } : { x: ofs, y: across, w: along, h: cross };
  });
}
