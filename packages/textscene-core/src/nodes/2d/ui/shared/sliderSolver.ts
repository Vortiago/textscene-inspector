/**
 * Shared HSlider/VSlider native (WebGL canvas) geometry — `Slider::get_minimum_size`
 * and `Slider::_notification(NOTIFICATION_DRAW)` (`scene/gui/slider.cpp`, Godot
 * 4.6.3), transposed for `vertical` (the `shared/splitContainerSolver.ts`
 * pattern for a slice family: HSlider and VSlider register this ONCE here, and
 * each slice's own `nativeSolver.ts`/`Component.tsx` supplies only its own
 * icon and `vertical` flag).
 *
 * NOT modelled — an explicit restriction:
 *  - `center_grabber` / `grabber_offset` / `tick_offset` — all 0 for both HSlider
 *    and VSlider in the default theme (`default_theme.cpp:594-596,609-611`); every
 *    formula below already has their (zero) contribution dropped.
 *  - the `gui_input` and gamepad-repeat arms that read `is_layout_rtl()`
 *    (`slider.cpp:77,116,144,160,216,224`) — drag, arrow-key and joypad
 *    stepping, none of which a static previewer reaches. The DRAW branch
 *    (`:331`) is ported: it reaches the `grabber_area` fill and the `grabber`
 *    icon only, since the track (`:333`) spans the full width either way and
 *    the tick loop (`:341-359`) marches over the same symmetric travel.
 *  - `ticks_position` (`Slider::TickPosition`) — `shared/slider.ts` parses only
 *    `tick_count`/`ticks_on_borders`/`editable`, so every tick here draws at
 *    Godot's own default, `TICK_POSITION_BOTTOM_RIGHT` (below an HSlider's
 *    track, right of a VSlider's).
 *  - hover/focus/drag ("highlighted") draw states — `grabber_area_highlight`
 *    and the `_hl` grabber icon are Slider's interactive states; a static
 *    previewer never has a mouse over anything, matching `Button`'s identical
 *    normal/disabled-only restriction.
 *
 * Pure data + functions, no React, no THREE.
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
 * `tick.svg`'s own CROSS-axis extent — the length a tick bar runs ACROSS the
 * track, perpendicular to the slider's travel. Measured directly off real
 * Godot 4.6.3 (`pnpm ref:godot`, a probe scene with `tick_count` set): the
 * painted tick band is exactly 8px tall/wide at `default_theme_scale = 1`,
 * matching `hslider_tick.svg`/`vslider_tick.svg`'s own declared canvas size
 * (`width="4" height="8"` / `width="8" height="4"` — the path inside draws to
 * `y="16"`/`x="16"` but Godot's SVG rasteriser clips to the declared canvas,
 * same as every other vendored icon in `native/themeIcons.ts`).
 *
 * Not scaled by `default_theme_scale`, same as `hsplitcontainer/Component.tsx`'s
 * `ICON_SIZE` — the codebase's existing convention for a vendored icon's own
 * literal pixel dimension.
 */
export const SLIDER_TICK_CROSS_AXIS = 8;

/**
 * `Slider::get_minimum_size()` (`slider.cpp:35-44`):
 *
 *     Size2i ss = theme_cache.slider_style->get_minimum_size();
 *     Size2i rs = theme_cache.grabber_icon->get_size();
 *     if (orientation == HORIZONTAL) return Size2i(ss.width, MAX(ss.height, rs.height));
 *     else return Size2i(MAX(ss.width, rs.width), ss.height);
 *
 * `slider_style`'s margins are equal on every side (`make_flat_stylebox(color,
 * 4, 4, 4, 4, 4)`, `default_theme.cpp:579`), so `ss.width === ss.height ===
 * sliderTrackThickness` regardless of axis. `grabber` is `rs` — the vendored
 * default is a square texture (`sliderGrabberIconSize`'s own doc), but a
 * themed `grabber` icon need not be, so every formula below takes it as a
 * `Vec2` rather than reading `theme.sliderGrabberSize` as a scalar.
 */
export function sliderMinimumSize(vertical: boolean, theme: NativeTheme, grabber: Vec2): Vec2 {
  const track = theme.sliderTrackThickness;
  return vertical ? { x: Math.max(track, grabber.x), y: track } : { x: track, y: Math.max(track, grabber.y) };
}

/**
 * `grabber_icon` (`Theme::DATA_TYPE_ICON` under key `"grabber"` —
 * `BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_ICON, Slider, grabber_icon,
 * "grabber")`, `slider.cpp:480`) — the ONE icon every geometry formula in
 * this module reads; `grabber_highlight`/`grabber_disabled` are interactive
 * draw states this previewer never reaches (module doc). Falls back to the
 * vendored default's own (square) size, `theme.sliderGrabberSize` on both
 * axes, when nothing themed it.
 */
export function sliderGrabberIconSize(
  theme: NativeTheme,
  textureSlots: Readonly<Record<string, Vec2 | null>>
): Vec2 {
  return textureSlots.grabber ?? { x: theme.sliderGrabberSize, y: theme.sliderGrabberSize };
}

/**
 * `Slider::_notification(NOTIFICATION_DRAW)`'s own ratio line:
 *
 *     double ratio = Math::is_nan(get_as_ratio()) ? 0 : get_as_ratio();
 *
 * `rangeRatio` (`shared/range.ts`) already reproduces `Range::get_as_ratio()`,
 * including its own degenerate-range guard (returns 1, never divides by
 * zero) — this only adds Slider's OWN NaN guard on top, reachable if a
 * consumer somehow authors a literal NaN value.
 *
 * `orderedKeys` threads through to `rangeRatio`'s own file-order-aware value
 * resolution (`resolveRangeValue`, ADR-0035) — `undefined` (the default)
 * keeps today's editor-save-order assumption.
 */
export function resolveSliderRatio(props: RangeProperties, orderedKeys?: RangeValueOrder): number {
  const ratio = rangeRatio(props, orderedKeys);
  return Number.isNaN(ratio) ? 0 : ratio;
}

/** `Size2i size = get_size()` — every draw formula below reads the narrowed size. */
const size2i = (size: Vec2): Vec2 => ({ x: Math.trunc(size.x), y: Math.trunc(size.y) });

/**
 * The `slider` StyleBox draw rect — `style->draw(...)`:
 *
 *     HORIZONTAL (slider.cpp:333): Rect2i(Point2i(0, (size.height - widget_height) / 2), Size2i(size.width, widget_height))
 *     VERTICAL   (slider.cpp:301): Rect2i(Point2i(size.width / 2 - widget_width / 2, 0), Size2i(widget_width, size.height))
 *
 * `widget_height`/`widget_width` is `style->get_minimum_size()`'s thickness on
 * the CROSS axis — `theme.sliderTrackThickness`, since the track stylebox's
 * margins are symmetric. The vertical branch truncates `size.width / 2` and
 * `widget_width / 2` SEPARATELY (two int divisions in the C++, not one over
 * their difference) — they agree whenever `widget_width` is even, which it
 * always is here (`2 * round(margin * scale)`), but the separate truncation
 * is transcribed anyway for fidelity to the source.
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
 * The `grabber_area` fill rect.
 *
 *     HORIZONTAL (slider.cpp:331-339): areasize = size.width - grabber.width;
 *       bool rtl = is_layout_rtl();
 *       int p = areasize * (rtl ? 1 - ratio : ratio) + grabber.width / 2;
 *       rtl ? Rect2i(Point2i(p, (size.height - widget_height) / 2), Size2i(size.width - p, widget_height))
 *           : Rect2i(Point2i(0, (size.height - widget_height) / 2), Size2i(p, widget_height))
 *     VERTICAL (slider.cpp:299,302): areasize = size.height - grabber.height;
 *       Rect2i(Point2i((size.width - widget_width) / 2,
 *                      Math::round(size.height - areasize * ratio - grabber.height / 2)),
 *              Size2i(widget_width, Math::round(areasize * ratio + grabber.height / 2)))
 *
 * The horizontal branch truncates via `int p` (assignment truncation); the
 * vertical branch calls `Math::round` explicitly on BOTH its origin and its
 * size — that asymmetry is Godot's own, not an inconsistency introduced here.
 *
 * `rtl` reverses the RATIO before that truncation, so the result is not the
 * LTR rect mirrored: each direction truncates its own product.
 */
export function sliderGrabberAreaRect(
  vertical: boolean,
  rawSize: Vec2,
  ratio: number,
  theme: NativeTheme,
  grabber: Vec2,
  /** `Control::is_layout_rtl()`; the vertical arm has no such branch in the source. */
  rtl: boolean
): Rect2 {
  const size = size2i(rawSize);
  const thickness = theme.sliderTrackThickness;
  if (vertical) {
    const areasize = size.y - grabber.y;
    // `grabber->get_height() / 2` is an INTEGER division (`slider.cpp:302`) —
    // an odd grabber contributes the floor, not the half.
    const halfGrabber = Math.trunc(grabber.y / 2);
    const x = Math.trunc((size.x - thickness) / 2);
    const y = Math.round(size.y - areasize * ratio - halfGrabber);
    const h = Math.round(areasize * ratio + halfGrabber);
    return { x, y, w: thickness, h };
  }
  const areasize = size.x - grabber.x;
  // `grabber->get_width() / 2` — same integer division (`slider.cpp:335`).
  const halfGrabber = Math.trunc(grabber.x / 2);
  const p = Math.trunc(areasize * (rtl ? 1 - ratio : ratio) + halfGrabber);
  const y = Math.trunc((size.y - thickness) / 2);
  return rtl ? { x: p, y, w: size.x - p, h: thickness } : { x: 0, y, w: p, h: thickness };
}

/**
 * The `grabber` icon box — the rect a Native painter positions its icon
 * texture at (Godot draws the texture at its OWN natural size from this
 * top-left, `Texture2D::draw`):
 *
 *     HORIZONTAL (slider.cpp:332,363): areasize = size.width - grabber.width;
 *       Point2i((rtl ? 1 - ratio : ratio) * areasize, size.height / 2 - grabber.height / 2)
 *     VERTICAL (slider.cpp:299,326): areasize = size.height - grabber.height;
 *       Point2i(size.width / 2 - grabber.width / 2, size.height - ratio * areasize - grabber.height)
 *
 * At `ratio = 0` (value = min_value) a HORIZONTAL grabber's LEFT edge sits at
 * `x = 0` and a VERTICAL grabber's BOTTOM edge sits at `y + h = size.height`;
 * at `ratio = 1` (value = max_value) the opposite edge is flush with the
 * opposite side of the rect — the two positions worth pinning, since an
 * off-by-a-grabber-width error is invisible at
 * `ratio = 0` and wrong everywhere else.
 */
export function sliderGrabberRect(
  vertical: boolean,
  rawSize: Vec2,
  ratio: number,
  grabber: Vec2,
  /** `Control::is_layout_rtl()`; the vertical arm has no such branch in the source. */
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
  // Two SEPARATE integer divisions (`slider.cpp:363`), as the vertical branch above.
  const y = Math.trunc(size.y / 2) - Math.trunc(grabber.y / 2);
  return { x, y, w: grabber.x, h: grabber.y };
}

/**
 * One rect per PAINTED tick index (`sliderTickIndices`'s output — the
 * `tick_count > 1` guard and the `ticks_on_borders` skip are already applied
 * there), at Godot's default `TICK_POSITION_BOTTOM_RIGHT`:
 *
 *     HORIZONTAL (slider.cpp:342-347): grabber_offset = grabber.width/2 - tick.width/2;
 *       ofs = i * areasize / (ticks - 1) + grabber_offset;
 *       tick->draw(ci, Point2i(ofs, widget_height + (size.height - widget_height) / 2))
 *     VERTICAL (slider.cpp:304-311): grabber_offset = grabber.height/2 - tick.height/2;
 *       ofs = i * areasize / (ticks - 1) + grabber_offset;
 *       tick->draw(ci, Point2i(widget_width + (size.width - widget_width) / 2, ofs))
 *
 * `tick.width`/`tick.height` here is `theme.sliderTickBox` — the ALONG-axis
 * box `hslider_tick.svg`/`vslider_tick.svg` share (both 4px, already scaled by
 * `default_theme_scale`); the icon's CROSS-axis extent is
 * `SLIDER_TICK_CROSS_AXIS` (see its own doc for why it is not the DOM
 * overlay's `sliderTickLength`). `areasize` is the SAME travel the grabber
 * uses — ticks march across the full grabber travel, not the visible track.
 * `ticks - 1` is `tickCount - 1` (the CONFIGURED count, not the painted
 * subset), matching `sliderChrome.ts`'s `divisions`.
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
  const along = theme.sliderTickBox;
  const cross = SLIDER_TICK_CROSS_AXIS;
  const divisions = tickCount - 1;
  // The travel axis's own grabber extent: WIDTH for horizontal, HEIGHT for
  // vertical (`slider.cpp:342-347,304-311`) — same axis `sliderGrabberAreaRect`
  // reads `areasize` off.
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

// The `slider` (track) and `grabber_area` (fill) default styleboxes
// (`default_theme.cpp:579-580`) are precomputed once per theme as
// `theme.widgets.slider.track`/`.fill`. Building them per call would hand
// `StyleBoxQuad` a fresh identity on every render and rebuild its
// `BufferGeometry` each time — twice per slider, since track and fill are
// separate quads. Their `contentMargin` is zero and never read back: the
// on-screen thickness comes from `theme.sliderTrackThickness` via
// `sliderTrackRect`/`sliderGrabberAreaRect`.
