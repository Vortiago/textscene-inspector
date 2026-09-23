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

import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { rangeRatio, type RangeProperties, type RangeValueOrder } from './range';

/**
 * `tick.svg`'s cross-axis extent. `pnpm ref:godot` paints an 8px band at `default_theme_scale = 1`,
 * the declared canvas of `hslider_tick.svg`/`vslider_tick.svg` (`width="4" height="8"`/`width="8"
 * height="4"`): the path draws to `y="16"`/`x="16"`, but the rasteriser clips to the canvas. Not
 * scaled by `default_theme_scale`, like every vendored icon's literal size.
 */
export const SLIDER_TICK_CROSS_AXIS = 8;

/**
 * `Slider::get_minimum_size()` (`slider.cpp:35-44`): `Size2i(ss.width, MAX(ss.height, rs.height))`
 * horizontally, `ss` the `slider` style and `rs` the `grabber` icon. The style's margins are equal
 * (`make_flat_stylebox(color, 4, 4, 4, 4, 4)`, `default_theme.cpp:579`), so both are
 * `sliderTrackThickness`. A themed `grabber` need not be square, so it is a `Vec2`.
 */
export function sliderMinimumSize(vertical: boolean, theme: NativeTheme, grabber: Vec2): Vec2 {
  const track = theme.sliderTrackThickness;
  return vertical ? { x: Math.max(track, grabber.x), y: track } : { x: track, y: Math.max(track, grabber.y) };
}

/**
 * `grabber_icon` (`BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_ICON, Slider, grabber_icon, "grabber")`,
 * `slider.cpp:480`), the one icon the geometry reads. `grabber_highlight`, `grabber_disabled` and
 * `grabber_area_highlight` are interactive states a still frame never shows. Unthemed, it is the
 * vendored square, `theme.sliderGrabberSize` on both axes.
 */
export function sliderGrabberIconSize(
  theme: NativeTheme,
  textureSlots: Readonly<Record<string, Vec2 | null>>
): Vec2 {
  return textureSlots.grabber ?? { x: theme.sliderGrabberSize, y: theme.sliderGrabberSize };
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

/** `Size2i size = get_size()`: every draw formula reads the narrowed size. */
const size2i = (size: Vec2): Vec2 => ({ x: Math.trunc(size.x), y: Math.trunc(size.y) });

/**
 * The `slider` StyleBox draw rect (`slider.cpp:333` horizontal, `slider.cpp:301` vertical), centred
 * at `(size.height - widget_height) / 2` with `widget_height` as `theme.sliderTrackThickness`. The vertical arm truncates
 * `size.width / 2` and `widget_width / 2` separately, as the C++ does, though `widget_width` is
 * always even here (`2 * round(margin * scale)`).
 */
export function sliderTrackRect(vertical: boolean, rawSize: Vec2, theme: NativeTheme): Rect2 {
  const size = size2i(rawSize);
  const thickness = theme.sliderTrackThickness;
  if (vertical) {
    return { x: Math.trunc(size.x / 2) - Math.trunc(thickness / 2), y: 0, w: thickness, h: size.y };
  }
  return { x: 0, y: Math.trunc((size.y - thickness) / 2), w: size.x, h: thickness };
}

/**
 * The `grabber_area` fill rect (`slider.cpp:331-339` horizontal, `slider.cpp:299,302` vertical).
 * The horizontal arm truncates through `int p`, and the vertical arm calls `Math::round` on its
 * origin and size, as Godot does. `rtl` reverses the ratio before the truncation, so the RTL
 * rect is not the LTR rect mirrored.
 */
export function sliderGrabberAreaRect(
  vertical: boolean,
  rawSize: Vec2,
  ratio: number,
  theme: NativeTheme,
  grabber: Vec2,
  /**
   * `Control::is_layout_rtl()`, which the vertical arm lacks. The draw branch (`:331`) reaches only
   * this fill and the grabber: the track (`:333`) spans the width and the tick loop (`:341-359`) is
   * symmetric. The `gui_input` arms (`slider.cpp:77,116,144,160,216,224`) are not ported.
   */
  rtl: boolean
): Rect2 {
  const size = size2i(rawSize);
  const thickness = theme.sliderTrackThickness;
  if (vertical) {
    const areasize = size.y - grabber.y;
    // `grabber->get_height() / 2` is an integer division (`slider.cpp:302`): an odd grabber
    // contributes the floor, not the half.
    const halfGrabber = Math.trunc(grabber.y / 2);
    const x = Math.trunc((size.x - thickness) / 2);
    const y = Math.round(size.y - areasize * ratio - halfGrabber);
    const h = Math.round(areasize * ratio + halfGrabber);
    return { x, y, w: thickness, h };
  }
  const areasize = size.x - grabber.x;
  // `grabber->get_width() / 2`: the same integer division (`slider.cpp:335`).
  const halfGrabber = Math.trunc(grabber.x / 2);
  const p = Math.trunc(areasize * (rtl ? 1 - ratio : ratio) + halfGrabber);
  const y = Math.trunc((size.y - thickness) / 2);
  return rtl ? { x: p, y, w: size.x - p, h: thickness } : { x: 0, y, w: p, h: thickness };
}

/**
 * The `grabber` icon box (`slider.cpp:332,363` horizontal, `slider.cpp:299,326` vertical): the
 * top-left where `Texture2D::draw` puts the texture at its natural size. `center_grabber`,
 * `grabber_offset` and `tick_offset` are 0 on both sliders (`default_theme.cpp:594-596,609-611`),
 * so no formula carries them.
 */
export function sliderGrabberRect(
  vertical: boolean,
  rawSize: Vec2,
  ratio: number,
  grabber: Vec2,
  /** `Control::is_layout_rtl()`, which the vertical arm lacks. */
  rtl: boolean
): Rect2 {
  const size = size2i(rawSize);
  if (vertical) {
    const areasize = size.y - grabber.y;
    const x = Math.trunc(size.x / 2) - Math.trunc(grabber.x / 2);
    const y = Math.trunc(size.y - ratio * areasize - grabber.y);
    return { x, y, w: grabber.x, h: grabber.y };
  }
  const areasize = size.x - grabber.x;
  const x = Math.trunc((rtl ? 1 - ratio : ratio) * areasize);
  // Two separate integer divisions (`slider.cpp:363`), as the vertical branch above.
  const y = Math.trunc(size.y / 2) - Math.trunc(grabber.y / 2);
  return { x, y, w: grabber.x, h: grabber.y };
}

/**
 * One rect per painted tick index from `sliderTickIndices`, at `TICK_POSITION_BOTTOM_RIGHT`
 * (`slider.cpp:342-347` horizontal, `slider.cpp:304-311` vertical), since `shared/slider.ts` does
 * not parse `ticks_position`. Ticks march across the grabber travel, not the visible track, and
 * divide by the configured `tickCount - 1`, as `sliderChrome.ts`'s `divisions` does.
 */
export function sliderTickRects(
  vertical: boolean,
  rawSize: Vec2,
  indices: readonly number[],
  tickCount: number,
  theme: NativeTheme,
  grabber: Vec2
): Rect2[] {
  const size = size2i(rawSize);
  // The 4px along-axis box of `hslider_tick.svg`/`vslider_tick.svg`, scaled by `default_theme_scale`.
  const along = theme.sliderTickBox;
  const cross = SLIDER_TICK_CROSS_AXIS;
  const divisions = tickCount - 1;
  // `grabber_offset = grabber.width/2 - tick.width/2` horizontally and
  // `grabber.height/2 - tick.height/2` vertically (`slider.cpp:342-347,304-311`), on the axis
  // `sliderGrabberAreaRect` reads `areasize` off.
  const grabberAlong = vertical ? grabber.y : grabber.x;
  const grabberOffset = Math.trunc(grabberAlong / 2) - Math.trunc(along / 2);

  if (vertical) {
    const areasize = size.y - grabberAlong;
    const x = Math.trunc(theme.sliderTrackThickness + (size.x - theme.sliderTrackThickness) / 2);
    return indices.map((i) => ({
      x,
      y: Math.trunc((i * areasize) / divisions + grabberOffset),
      w: cross,
      h: along,
    }));
  }
  const areasize = size.x - grabberAlong;
  const y = Math.trunc(theme.sliderTrackThickness + (size.y - theme.sliderTrackThickness) / 2);
  return indices.map((i) => ({
    x: Math.trunc((i * areasize) / divisions + grabberOffset),
    y,
    w: along,
    h: cross,
  }));
}

// The `slider` track and `grabber_area` fill styleboxes (`default_theme.cpp:579-580`) are
// precomputed per theme as `theme.widgets.slider.track`/`.fill`: a per-call build hands
// `StyleBoxQuad` a fresh identity and rebuilds its `BufferGeometry` every render. Their zero
// `contentMargin` is never read, as the thickness is `theme.sliderTrackThickness`.
