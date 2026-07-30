/**
 * Shared HSlider/VSlider native (WebGL canvas) geometry — `Slider::get_minimum_size`
 * and `Slider::_notification(NOTIFICATION_DRAW)` (`scene/gui/slider.cpp`, Godot
 * 4.6.3), transposed for `vertical` (the `shared/splitContainerSolver.ts`
 * pattern for a slice family: HSlider and VSlider register this ONCE here, and
 * each slice's own `nativeSolver.ts`/`NativeComponent.tsx` supplies only its own
 * icon and `vertical` flag).
 *
 * NOT modelled, matching `sliderChrome.ts` (the DOM-overlay twin)'s own documented
 * restriction:
 *  - `center_grabber` / `grabber_offset` / `tick_offset` — all 0 for both HSlider
 *    and VSlider in the default theme (`default_theme.cpp:594-596,609-611`); every
 *    formula below already has their (zero) contribution dropped.
 *  - `is_layout_rtl()` — this previewer has no notion of layout direction
 *    anywhere else either, so every rect below is the LTR branch.
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
import { rangeRatio, type RangeProperties } from './range';

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
 * This deliberately DIVERGES from `godotDefaultTheme.ts`'s `SLIDER_TICK_LENGTH`
 * (16), which the DOM overlay (`sliderChrome.ts`) draws a synthetic bar at —
 * that constant predates this measurement and is a DOM-overlay-owned file
 * outside this painter's scope, so it is left alone here; see this packet's
 * own report for the discrepancy. Not scaled by `default_theme_scale`, same as
 * `hsplitcontainer/NativeComponent.tsx`'s `ICON_SIZE` — the codebase's existing
 * convention for a vendored icon's own literal pixel dimension.
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
 * sliderTrackThickness` regardless of axis; `grabber_icon` is a square texture,
 * so `rs.width === rs.height === sliderGrabberSize`.
 */
export function sliderMinimumSize(vertical: boolean, theme: NativeTheme): Vec2 {
  const track = theme.sliderTrackThickness;
  const grabber = theme.sliderGrabberSize;
  return vertical ? { x: Math.max(track, grabber), y: track } : { x: track, y: Math.max(track, grabber) };
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
 */
export function resolveSliderRatio(props: RangeProperties): number {
  const ratio = rangeRatio(props);
  return Number.isNaN(ratio) ? 0 : ratio;
}

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
export function sliderTrackRect(vertical: boolean, size: Vec2, theme: NativeTheme): Rect2 {
  const thickness = theme.sliderTrackThickness;
  if (vertical) {
    return { x: Math.trunc(size.x / 2) - Math.trunc(thickness / 2), y: 0, w: thickness, h: size.y };
  }
  return { x: 0, y: Math.trunc((size.y - thickness) / 2), w: size.x, h: thickness };
}

/**
 * The `grabber_area` fill rect (LTR only — the RTL branch is not modelled).
 *
 *     HORIZONTAL (slider.cpp:334,338): areasize = size.width - grabber.width;
 *       int p = areasize * ratio + grabber.width / 2;
 *       Rect2i(Point2i(0, (size.height - widget_height) / 2), Size2i(p, widget_height))
 *     VERTICAL (slider.cpp:299,302): areasize = size.height - grabber.height;
 *       Rect2i(Point2i((size.width - widget_width) / 2,
 *                      Math::round(size.height - areasize * ratio - grabber.height / 2)),
 *              Size2i(widget_width, Math::round(areasize * ratio + grabber.height / 2)))
 *
 * The horizontal branch truncates via `int p` (assignment truncation); the
 * vertical branch calls `Math::round` explicitly on BOTH its origin and its
 * size — that asymmetry is Godot's own, not an inconsistency introduced here.
 */
export function sliderGrabberAreaRect(vertical: boolean, size: Vec2, ratio: number, theme: NativeTheme): Rect2 {
  const thickness = theme.sliderTrackThickness;
  const grabber = theme.sliderGrabberSize;
  if (vertical) {
    const areasize = size.y - grabber;
    const x = Math.trunc((size.x - thickness) / 2);
    const y = Math.round(size.y - areasize * ratio - grabber / 2);
    const h = Math.round(areasize * ratio + grabber / 2);
    return { x, y, w: thickness, h };
  }
  const areasize = size.x - grabber;
  const p = Math.trunc(areasize * ratio + grabber / 2);
  return { x: 0, y: Math.trunc((size.y - thickness) / 2), w: p, h: thickness };
}

/**
 * The `grabber` icon box — the rect a Native painter positions its icon
 * texture at (Godot draws the texture at its OWN natural size from this
 * top-left, `Texture2D::draw`):
 *
 *     HORIZONTAL (slider.cpp:334,363): areasize = size.width - grabber.width;
 *       Point2i(ratio * areasize, size.height / 2 - grabber.height / 2)
 *     VERTICAL (slider.cpp:299,326): areasize = size.height - grabber.height;
 *       Point2i(size.width / 2 - grabber.width / 2, size.height - ratio * areasize - grabber.height)
 *
 * At `ratio = 0` (value = min_value) a HORIZONTAL grabber's LEFT edge sits at
 * `x = 0` and a VERTICAL grabber's BOTTOM edge sits at `y + h = size.height`;
 * at `ratio = 1` (value = max_value) the opposite edge is flush with the
 * opposite side of the rect — the two pinned positions this packet's own
 * brief calls out, since an off-by-a-grabber-width error is invisible at
 * `ratio = 0` and wrong everywhere else.
 */
export function sliderGrabberRect(vertical: boolean, size: Vec2, ratio: number, theme: NativeTheme): Rect2 {
  const grabber = theme.sliderGrabberSize;
  if (vertical) {
    const areasize = size.y - grabber;
    const x = Math.trunc(size.x / 2) - Math.trunc(grabber / 2);
    const y = Math.trunc(size.y - ratio * areasize - grabber);
    return { x, y, w: grabber, h: grabber };
  }
  const areasize = size.x - grabber;
  const x = Math.trunc(ratio * areasize);
  const y = Math.trunc(size.y / 2 - grabber / 2);
  return { x, y, w: grabber, h: grabber };
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
  size: Vec2,
  indices: readonly number[],
  tickCount: number,
  theme: NativeTheme
): Rect2[] {
  const grabber = theme.sliderGrabberSize;
  const along = theme.sliderTickBox;
  const cross = SLIDER_TICK_CROSS_AXIS;
  const divisions = tickCount - 1;
  const grabberOffset = Math.trunc(grabber / 2) - Math.trunc(along / 2);

  if (vertical) {
    const areasize = size.y - grabber;
    const x = Math.trunc(theme.sliderTrackThickness + (size.x - theme.sliderTrackThickness) / 2);
    return indices.map((i) => ({
      x,
      y: Math.trunc((i * areasize) / divisions + grabberOffset),
      w: cross,
      h: along,
    }));
  }
  const areasize = size.x - grabber;
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
