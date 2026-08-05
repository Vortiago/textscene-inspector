/**
 * Godot-parity contract for the shared HSlider/VSlider native (WebGL canvas)
 * geometry — `Slider::get_minimum_size` and
 * `Slider::_notification(NOTIFICATION_DRAW)` (`scene/gui/slider.cpp`, Godot
 * 4.6.3), transposed for `vertical`. Every expected number below is either a
 * hand-derived worked example from the cited source lines, or a pixel
 * measured directly off real Godot 4.6 via `pnpm ref:godot` — never the
 * implementation's own output.
 *
 * At `default_theme_scale = 1` (`nativeTheme(1)`):
 *  - `style_slider`/`style_slider_grabber` are both
 *    `make_flat_stylebox(color, 4, 4, 4, 4, 4)` (`default_theme.cpp:579-580`)
 *    — content margins 4 all round, corner radius 4. `StyleBox::get_minimum_size()`
 *    sums opposing margins, so the track's OWN thickness is 4 + 4 = 8
 *    (`nativeTheme.ts`'s `sliderTrackThickness`).
 *  - `slider_grabber.svg` is a 16x16 texture (`nativeTheme.ts`'s
 *    `sliderGrabberSize`) holding a filled circle.
 *  - `center_grabber` / `grabber_offset` / `tick_offset` are 0 for both
 *    HSlider and VSlider (`default_theme.cpp:594-596,609-611`) — every
 *    formula below already has their (zero) contribution dropped.
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import {
  resolveSliderRatio,
  sliderGrabberAreaRect,
  sliderGrabberRect,
  sliderMinimumSize,
  sliderTickRects,
  sliderTrackRect,
  SLIDER_TICK_CROSS_AXIS,
} from './sliderSolver';

const theme = nativeTheme(1);
const theme2x = nativeTheme(2);

describe('resolveSliderRatio', () => {
  it('reads a mid-range value through Range::get_as_ratio (happy path)', () => {
    expect(resolveSliderRatio({ value: 25, maxValue: 100 })).toBeCloseTo(0.25);
  });

  it('is NaN-guarded to 0 — `Math::is_nan(get_as_ratio()) ? 0 : get_as_ratio()` (edge case)', () => {
    // A degenerate min===max range already returns 1 from `rangeRatio`
    // (Range::get_as_ratio's own is_equal_approx guard), so the only way to
    // reach the NaN branch here is a genuinely NaN authored value.
    expect(resolveSliderRatio({ value: Number.NaN })).toBe(0);
  });
});

describe('sliderMinimumSize — Slider::get_minimum_size (slider.cpp:35-44)', () => {
  it('floors a HORIZONTAL slider at (track, MAX(track, grabber)) = (8, 16)', () => {
    expect(sliderMinimumSize(false, theme)).toEqual({ x: 8, y: 16 });
  });

  it('transposes that for VERTICAL: (MAX(track, grabber), track) = (16, 8)', () => {
    expect(sliderMinimumSize(true, theme)).toEqual({ x: 16, y: 8 });
  });

  it('scales with default_theme_scale — track doubles to 16, grabber to 32', () => {
    expect(sliderMinimumSize(false, theme2x)).toEqual({ x: 16, y: 32 });
  });
});

describe('sliderTrackRect — the `slider` StyleBox draw rect', () => {
  it('runs the full WIDTH of a horizontal track, 8px thick, vertically centred (slider.cpp:333)', () => {
    // `Rect2i(Point2i(0, (size.height - widget_height) / 2), Size2i(size.width, widget_height))`
    expect(sliderTrackRect(false, { x: 300, y: 40 }, theme)).toEqual({ x: 0, y: 16, w: 300, h: 8 });
  });

  it('runs the full HEIGHT of a vertical track, 8px thick, horizontally centred (slider.cpp:301)', () => {
    // `Rect2i(Point2i(size.width / 2 - widget_width / 2, 0), Size2i(widget_width, size.height))`
    expect(sliderTrackRect(true, { x: 40, y: 300 }, theme)).toEqual({ x: 16, y: 0, w: 8, h: 300 });
  });
});

describe('sliderGrabberAreaRect — the `grabber_area` fill (LTR only, no RTL)', () => {
  it('spans to the grabber CENTRE at value=min, so the stub still shows half the grabber (slider.cpp:334-338)', () => {
    // areasize = 300 - 16 = 284; p = 284*0 + 16/2 = 8.
    expect(sliderGrabberAreaRect(false, { x: 300, y: 40 }, 0, theme)).toEqual({ x: 0, y: 16, w: 8, h: 8 });
  });

  it('grows with the ratio on a HORIZONTAL slider, keeping the half-grabber term', () => {
    // p = 284*0.5 + 8 = 150.
    expect(sliderGrabberAreaRect(false, { x: 300, y: 40 }, 0.5, theme)).toEqual({ x: 0, y: 16, w: 150, h: 8 });
  });

  it('is pinned to the BOTTOM on a VERTICAL slider, matching origin+height (slider.cpp:302)', () => {
    // areasize = 300 - 16 = 284; y = round(300 - 284*0.5 - 8) = round(150) = 150;
    // h = round(284*0.5 + 8) = round(150) = 150.
    const rect = sliderGrabberAreaRect(true, { x: 40, y: 300 }, 0.5, theme);
    expect(rect).toEqual({ x: 16, y: 150, w: 8, h: 150 });
  });
});

describe('sliderGrabberRect — the `grabber` icon box, a value at min/max pins its END positions', () => {
  it('puts a HORIZONTAL grabber flush LEFT at value=min_value (slider.cpp:363)', () => {
    // x = 0 * areasize = 0; y = trunc(40/2 - 16/2) = 12.
    expect(sliderGrabberRect(false, { x: 300, y: 40 }, 0, theme)).toEqual({ x: 0, y: 12, w: 16, h: 16 });
  });

  it('puts a HORIZONTAL grabber flush RIGHT at value=max_value — right edge === size.width', () => {
    // areasize = 300 - 16 = 284; x = 1 * 284 = 284; 284 + 16(grabber width) = 300 = size.width.
    const rect = sliderGrabberRect(false, { x: 300, y: 40 }, 1, theme);
    expect(rect).toEqual({ x: 284, y: 12, w: 16, h: 16 });
    expect(rect.x + rect.w).toBe(300);
  });

  it('puts a VERTICAL grabber flush BOTTOM at value=min_value — bottom edge === size.height (slider.cpp:326)', () => {
    // y = 300 - 0*areasize - 16 = 284; 284 + 16 = 300 = size.height.
    const rect = sliderGrabberRect(true, { x: 40, y: 300 }, 0, theme);
    expect(rect).toEqual({ x: 12, y: 284, w: 16, h: 16 });
    expect(rect.y + rect.h).toBe(300);
  });

  it('puts a VERTICAL grabber flush TOP at value=max_value', () => {
    // areasize = 284; y = 300 - 1*284 - 16 = 0.
    expect(sliderGrabberRect(true, { x: 40, y: 300 }, 1, theme)).toEqual({ x: 12, y: 0, w: 16, h: 16 });
  });

  it('scales the grabber box with default_theme_scale', () => {
    expect(sliderGrabberRect(false, { x: 300, y: 40 }, 0, theme2x)).toEqual({ x: 0, y: 4, w: 32, h: 32 });
  });
});

describe('sliderTickRects — the `tick` icon per painted index, TICK_POSITION_BOTTOM_RIGHT (Godot default)', () => {
  it('draws the icon at its OWN measured size — 4 wide x 8 tall for hslider_tick', () => {
    expect(SLIDER_TICK_CROSS_AXIS).toBe(8);
  });

  it('spaces interior ticks across the travel for a HORIZONTAL slider (slider.cpp:342-347)', () => {
    // grabber_offset = trunc(16/2) - trunc(4/2) = 8 - 2 = 6.
    // i=1 of [0,1,2,3,4] (5 ticks): ofs = trunc(1*284/4 + 6) = trunc(71+6) = 77.
    // y = trunc(8 + (40 - 8) / 2) = trunc(8 + 16) = 24.
    const rects = sliderTickRects(false, { x: 300, y: 40 }, [1, 2, 3], 5, theme);
    expect(rects[0]).toEqual({ x: 77, y: 24, w: 4, h: 8 });
  });

  it('marches a VERTICAL slider’s ticks from the TOP, transposed box (slider.cpp:304-311)', () => {
    // grabber_offset = trunc(16/2) - trunc(4/2) = 6.
    // i=0 of [0,1,2] (3 ticks, borders on): ofs = trunc(0*284/2 + 6) = 6.
    // x = trunc(8 + (40 - 8) / 2) = 24.
    const rects = sliderTickRects(true, { x: 40, y: 300 }, [0, 1, 2], 3, theme);
    expect(rects[0]).toEqual({ x: 24, y: 6, w: 8, h: 4 });
  });

  it('returns one rect per painted index, in order', () => {
    const rects = sliderTickRects(false, { x: 300, y: 40 }, [0, 1, 2, 3, 4], 5, theme);
    expect(rects).toHaveLength(5);
  });

  it('returns nothing for an empty index list (tick_count unset or <= 1)', () => {
    expect(sliderTickRects(false, { x: 300, y: 40 }, [], 0, theme)).toEqual([]);
  });
});
