/**
 * Godot-parity contract for the shared HSlider/VSlider geometry (`scene/gui/slider.cpp`, Godot
 * 4.6.3). Each expected number is worked by hand from the cited lines or measured with
 * `pnpm ref:godot`, never the implementation's output. The zero `center_grabber`, `grabber_offset`
 * and `tick_offset` (`default_theme.cpp:594-596,609-611`) are dropped from every formula.
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import {
  resolveSliderRatio,
  sliderGrabberAreaRect,
  sliderGrabberIconSize,
  sliderGrabberRect,
  sliderMinimumSize,
  sliderTickRects,
  sliderTrackRect,
  SLIDER_TICK_CROSS_AXIS,
} from './sliderSolver';

const theme = nativeTheme(1);
const theme2x = nativeTheme(2);

/**
 * At `nativeTheme(1)` the grabber is the square 16x16 `slider_grabber.svg`, and `style_slider` is
 * `make_flat_stylebox(color, 4, 4, 4, 4, 4)` (`default_theme.cpp:579-580`), so the track is
 * 4 + 4 = 8 thick (`sliderTrackThickness`).
 */
const grabberOf = (t: NativeTheme) => ({ x: t.sliderGrabberSize, y: t.sliderGrabberSize });

describe('resolveSliderRatio', () => {
  it('reads a mid-range value through Range::get_as_ratio (happy path)', () => {
    expect(resolveSliderRatio({ value: 25, maxValue: 100 })).toBeCloseTo(0.25);
  });

  it('is NaN-guarded to 0 — `Math::is_nan(get_as_ratio()) ? 0 : get_as_ratio()` (edge case)', () => {
    // A degenerate min===max range already returns 1 from `rangeRatio` (Range::get_as_ratio's
    // is_equal_approx guard), so only a NaN authored value reaches the NaN branch.
    expect(resolveSliderRatio({ value: Number.NaN })).toBe(0);
  });

  it('threads orderedKeys through to rangeRatio’s file-order-aware value resolution (ADR-0035)', () => {
    const props = { value: 150, minValue: 0, maxValue: 200 };
    expect(resolveSliderRatio(props, ['value', 'min_value', 'max_value'])).toBeCloseTo(0.5, 10);
    expect(resolveSliderRatio(props, ['min_value', 'max_value', 'value'])).toBeCloseTo(0.75, 10);
  });
});

describe('sliderMinimumSize — Slider::get_minimum_size (slider.cpp:35-44)', () => {
  it('floors a HORIZONTAL slider at (track, MAX(track, grabber)) = (8, 16)', () => {
    expect(sliderMinimumSize(false, theme, grabberOf(theme))).toEqual({ x: 8, y: 16 });
  });

  it('transposes that for VERTICAL: (MAX(track, grabber), track) = (16, 8)', () => {
    expect(sliderMinimumSize(true, theme, grabberOf(theme))).toEqual({ x: 16, y: 8 });
  });

  it('scales with default_theme_scale — track doubles to 16, grabber to 32', () => {
    expect(sliderMinimumSize(false, theme2x, grabberOf(theme2x))).toEqual({ x: 16, y: 32 });
  });

  it('floors on a themed grabber\'s own (possibly non-square) size, not the vendored 16x16', () => {
    // HORIZONTAL reads grabber HEIGHT only (slider.cpp:37: MAX(ss.height, rs.height)).
    expect(sliderMinimumSize(false, theme, { x: 40, y: 24 })).toEqual({ x: 8, y: 24 });
    // VERTICAL reads grabber WIDTH only (slider.cpp:39: MAX(ss.width, rs.width)).
    expect(sliderMinimumSize(true, theme, { x: 40, y: 24 })).toEqual({ x: 40, y: 8 });
  });
});

describe('sliderGrabberIconSize — BIND_THEME_ITEM_CUSTOM(..., grabber_icon, "grabber") (slider.cpp:480)', () => {
  it('is the vendored square default when nothing themed the "grabber" slot', () => {
    expect(sliderGrabberIconSize(theme, {})).toEqual({ x: 16, y: 16 });
  });

  it('is the themed size when the walker resolved a "grabber" texture slot', () => {
    expect(sliderGrabberIconSize(theme, { grabber: { x: 20, y: 10 } })).toEqual({ x: 20, y: 10 });
  });

  it('ignores an interactive-only slot ("grabber_highlight"/"grabber_disabled") — never modelled (module doc)', () => {
    expect(sliderGrabberIconSize(theme, { grabber_disabled: { x: 99, y: 99 } })).toEqual({ x: 16, y: 16 });
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

describe('sliderGrabberAreaRect — the `grabber_area` fill', () => {
  it('spans to the grabber CENTRE at value=min, so the stub still shows half the grabber (slider.cpp:334-338)', () => {
    // areasize = 300 - 16 = 284; p = 284*0 + 16/2 = 8.
    expect(sliderGrabberAreaRect(false, { x: 300, y: 40 }, 0, theme, grabberOf(theme), false)).toEqual({ x: 0, y: 16, w: 8, h: 8 });
  });

  it('floors the half-grabber term — `grabber->get_width() / 2` is INTEGER division (slider.cpp:334)', () => {
    // Only an odd grabber shows it, and 16 * 1.1 rounds to 18, so a theme sets 15 directly.
    // p = areasize*0 + trunc(grabber/2).
    const odd = nativeTheme(1);
    const oddTheme = { ...odd, sliderGrabberSize: 15 };
    expect(sliderGrabberAreaRect(false, { x: 300, y: 40 }, 0, oddTheme, grabberOf(oddTheme), false).w).toBe(7);
  });

  it('grows with the ratio on a HORIZONTAL slider, keeping the half-grabber term', () => {
    // p = 284*0.5 + 8 = 150.
    expect(sliderGrabberAreaRect(false, { x: 300, y: 40 }, 0.5, theme, grabberOf(theme), false)).toEqual({ x: 0, y: 16, w: 150, h: 8 });
  });

  it('is pinned to the BOTTOM on a VERTICAL slider, matching origin+height (slider.cpp:302)', () => {
    // areasize = 300 - 16 = 284; y = round(300 - 284*0.5 - 8) = round(150) = 150;
    // h = round(284*0.5 + 8) = round(150) = 150.
    const rect = sliderGrabberAreaRect(true, { x: 40, y: 300 }, 0.5, theme, grabberOf(theme), false);
    expect(rect).toEqual({ x: 16, y: 150, w: 8, h: 150 });
  });
});

describe('sliderGrabberRect — the `grabber` icon box, a value at min/max pins its END positions', () => {
  it('puts a HORIZONTAL grabber flush LEFT at value=min_value (slider.cpp:363)', () => {
    // x = 0 * areasize = 0; y = trunc(40/2 - 16/2) = 12.
    expect(sliderGrabberRect(false, { x: 300, y: 40 }, 0, grabberOf(theme), false)).toEqual({ x: 0, y: 12, w: 16, h: 16 });
  });

  it('puts a HORIZONTAL grabber flush RIGHT at value=max_value — right edge === size.width', () => {
    // areasize = 300 - 16 = 284; x = 1 * 284 = 284; 284 + 16(grabber width) = 300 = size.width.
    const rect = sliderGrabberRect(false, { x: 300, y: 40 }, 1, grabberOf(theme), false);
    expect(rect).toEqual({ x: 284, y: 12, w: 16, h: 16 });
    expect(rect.x + rect.w).toBe(300);
  });

  it('puts a VERTICAL grabber flush BOTTOM at value=min_value — bottom edge === size.height (slider.cpp:326)', () => {
    // y = 300 - 0*areasize - 16 = 284; 284 + 16 = 300 = size.height.
    const rect = sliderGrabberRect(true, { x: 40, y: 300 }, 0, grabberOf(theme), false);
    expect(rect).toEqual({ x: 12, y: 284, w: 16, h: 16 });
    expect(rect.y + rect.h).toBe(300);
  });

  it('puts a VERTICAL grabber flush TOP at value=max_value', () => {
    // areasize = 284; y = 300 - 1*284 - 16 = 0.
    expect(sliderGrabberRect(true, { x: 40, y: 300 }, 1, grabberOf(theme), false)).toEqual({ x: 12, y: 0, w: 16, h: 16 });
  });

  it('scales the grabber box with default_theme_scale', () => {
    expect(sliderGrabberRect(false, { x: 300, y: 40 }, 0, grabberOf(theme2x), false)).toEqual({ x: 0, y: 4, w: 32, h: 32 });
  });
});

describe('is_layout_rtl() — the ONE draw branch Slider reads it in (slider.cpp:331)', () => {
  // areasize = 120 - 16 = 104, so `areasize * ratio` is fractional at 0.3 on both sides: the
  // inputs that separate Godot's arithmetic from a mirrored LTR rect.
  const size = { x: 120, y: 24 };
  const grabber = grabberOf(theme);

  it('fills the `grabber_area` from the RIGHT edge inward, at its OWN truncated p (slider.cpp:335-337)', () => {
    // p = int(104 * (1 - 0.3) + 16/2) = int(80.8) = 80;
    // Rect2i(Point2i(p, (24-8)/2), Size2i(size.width - p, 8)).
    expect(sliderGrabberAreaRect(false, size, 0.3, theme, grabber, true)).toEqual({
      x: 80,
      y: 8,
      w: 40,
      h: 8,
    });
  });

  it('is NOT the LTR fill mirrored — each direction truncates its own product (slider.cpp:335)', () => {
    // LTR p = int(104 * 0.3 + 8) = int(39.2) = 39, and 120 - 39 = 81, one px
    // past the 80 the RTL branch computes.
    expect(sliderGrabberAreaRect(false, size, 0.3, theme, grabber, false)).toEqual({
      x: 0,
      y: 8,
      w: 39,
      h: 8,
    });
  });

  it('draws the `grabber` icon from the opposite end of the SAME travel (slider.cpp:363)', () => {
    // x = int((1 - 0.3) * 104) = int(72.8) = 72; y = 24/2 - 16/2 = 4.
    expect(sliderGrabberRect(false, size, 0.3, grabber, true)).toEqual({ x: 72, y: 4, w: 16, h: 16 });
  });

  it('is NOT the LTR grabber mirrored either', () => {
    // LTR x = int(0.3 * 104) = 31, whose mirror is 120 - 16 - 31 = 73.
    expect(sliderGrabberRect(false, size, 0.3, grabber, false)).toEqual({ x: 31, y: 4, w: 16, h: 16 });
  });

  it('leaves a VERTICAL slider alone — slider.cpp:297-326 contains no is_layout_rtl() call', () => {
    const vSize = { x: 24, y: 120 };
    expect(sliderGrabberAreaRect(true, vSize, 0.3, theme, grabber, true)).toEqual(
      sliderGrabberAreaRect(true, vSize, 0.3, theme, grabber, false)
    );
    expect(sliderGrabberRect(true, vSize, 0.3, grabber, true)).toEqual(
      sliderGrabberRect(true, vSize, 0.3, grabber, false)
    );
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
    const rects = sliderTickRects(false, { x: 300, y: 40 }, [1, 2, 3], 5, theme, grabberOf(theme));
    expect(rects[0]).toEqual({ x: 77, y: 24, w: 4, h: 8 });
  });

  it('marches a VERTICAL slider’s ticks from the TOP, transposed box (slider.cpp:304-311)', () => {
    // grabber_offset = trunc(16/2) - trunc(4/2) = 6.
    // i=0 of [0,1,2] (3 ticks, borders on): ofs = trunc(0*284/2 + 6) = 6.
    // x = trunc(8 + (40 - 8) / 2) = 24.
    const rects = sliderTickRects(true, { x: 40, y: 300 }, [0, 1, 2], 3, theme, grabberOf(theme));
    expect(rects[0]).toEqual({ x: 24, y: 6, w: 8, h: 4 });
  });

  it('returns one rect per painted index, in order', () => {
    const rects = sliderTickRects(false, { x: 300, y: 40 }, [0, 1, 2, 3, 4], 5, theme, grabberOf(theme));
    expect(rects).toHaveLength(5);
  });

  it('returns nothing for an empty index list (tick_count unset or <= 1)', () => {
    expect(sliderTickRects(false, { x: 300, y: 40 }, [], 0, theme, grabberOf(theme))).toEqual([]);
  });
});

// Every draw formula (`Slider::_notification`, NOTIFICATION_DRAW) opens on `Size2i size =
// get_size()`, so a fractional size, as a text-derived minimum gives, narrows once and every rect
// is integral.
describe('slider draw rects — Size2i narrowing', () => {
  it('narrows the control size before the track rect reads it', () => {
    const track = sliderTrackRect(false, { x: 200.6, y: 40.9 }, theme);
    expect(track.w).toBe(200);
  });

  it('narrows it for the vertical track too', () => {
    expect(sliderTrackRect(true, { x: 40.9, y: 200.6 }, theme).h).toBe(200);
  });

  it('narrows it for the tick rects', () => {
    const ticks = sliderTickRects(false, { x: 200.6, y: 40.9 }, [0, 1], 2, theme, grabberOf(theme));
    expect(ticks.every((t) => Number.isInteger(t.x) && Number.isInteger(t.y))).toBe(true);
  });
});

// `size.height / 2 - grabber->get_height() / 2` (`slider.cpp:363`): two integer divisions, not
// one of the difference. They agree for an even grabber, as 16 is at scale 1, and scale 0.95
// rounds it to 15 and separates them.
describe('sliderGrabberRect — the two separate integer divisions', () => {
  const odd = nativeTheme(0.95);

  it('centres a 15px grabber in a 40px-tall slider at y=13, not 12', () => {
    expect(odd.sliderGrabberSize).toBe(15);
    // 40 / 2 = 20; 15 / 2 = 7; 20 - 7 = 13. Fusing them gives trunc(12.5) = 12.
    expect(sliderGrabberRect(false, { x: 200, y: 40 }, 0, grabberOf(odd), false).y).toBe(13);
  });

  it('mirrors it on the vertical axis', () => {
    expect(sliderGrabberRect(true, { x: 40, y: 200 }, 0, grabberOf(odd), false).x).toBe(13);
  });
});
