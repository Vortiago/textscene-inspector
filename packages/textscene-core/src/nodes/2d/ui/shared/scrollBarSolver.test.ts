/**
 * The scrollbar geometry against Godot 4.6.3 (`scene/gui/scroll_bar.cpp`) at
 * `default_theme_scale = 1`: `contentMargin = 4`, so every grabber and track along-axis minimum is 8
 * (`scroll_bar.cpp:473-477`, `default_theme.cpp:543-545`).
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import {
  scrollBarAreaSize,
  scrollBarGrabberGeometry,
  scrollBarGrabberRect,
  scrollBarMinimumSize,
  scrollBarTrackRect,
} from './scrollBarSolver';

const THEME = nativeTheme(1);
const GRABBER_MIN = 8; // 2 * contentMargin (scroll_bar.cpp:473-477, default_theme.cpp:545).
const BAR_LENGTH = 300;
const AREA_SIZE = BAR_LENGTH - GRABBER_MIN; // scroll_bar.cpp:491-513, with the track and icon along-axis terms 0.

describe('scrollBarMinimumSize (scroll_bar.cpp:519-548)', () => {
  it('is (8, 8) at scale 1 for HORIZONTAL — track cross-axis minimum + grabber along-axis minimum, both 2*contentMargin', () => {
    expect(scrollBarMinimumSize(false, THEME)).toEqual({ x: 8, y: 8 });
  });

  it('is (8, 8) at scale 1 for VERTICAL too — the same two constants, transposed', () => {
    expect(scrollBarMinimumSize(true, THEME)).toEqual({ x: 8, y: 8 });
  });
});

describe('scrollBarAreaSize (scroll_bar.cpp:491-513)', () => {
  it('is barLength minus the grabber minimum — track/icon along-axis terms are 0 in the default theme', () => {
    expect(scrollBarAreaSize(false, BAR_LENGTH, THEME)).toBe(AREA_SIZE);
    expect(scrollBarAreaSize(true, BAR_LENGTH, THEME)).toBe(AREA_SIZE);
  });
});

describe('scrollBarGrabberGeometry (scroll_bar.cpp:479-517)', () => {
  it('at page=0 (default), the grabber is exactly its own minimum size, flush at the low end (value=min)', () => {
    // page term: (0/range)*areaSize = 0, so size floors to grabber_min_size alone.
    const g = scrollBarGrabberGeometry(false, BAR_LENGTH, THEME, 0, 100, 0, 0);
    expect(g).toEqual({ size: GRABBER_MIN, offset: 0 });
  });

  it('offsets to the far end at value=max (ratio=1), size unchanged by value alone', () => {
    const g = scrollBarGrabberGeometry(false, BAR_LENGTH, THEME, 0, 100, 0, 1);
    expect(g.offset).toBe(AREA_SIZE); // area_size * 1
    expect(g.offset + g.size).toBe(BAR_LENGTH); // flush with the bar's own far edge
  });

  it('offsets to the midpoint at ratio=0.5', () => {
    const g = scrollBarGrabberGeometry(false, BAR_LENGTH, THEME, 0, 100, 0, 0.5);
    expect(g.offset).toBe(AREA_SIZE * 0.5);
  });

  it('fills the ENTIRE bar length when page covers the whole range (page === max - min)', () => {
    // clampedPage/range = 1, so size = area_size + grabber_min = (barLength -
    // grabber_min) + grabber_min = barLength.
    const g = scrollBarGrabberGeometry(false, BAR_LENGTH, THEME, 0, 100, 100, 0);
    expect(g.size).toBe(BAR_LENGTH);
  });

  it('clamps an over-range page to the range, matching Range::set_page (range.cpp:254-256)', () => {
    const clamped = scrollBarGrabberGeometry(false, BAR_LENGTH, THEME, 0, 100, 500, 0);
    const atRange = scrollBarGrabberGeometry(false, BAR_LENGTH, THEME, 0, 100, 100, 0);
    expect(clamped.size).toBe(atRange.size);
  });

  it('returns a zero-size, zero-offset grabber when min === max (scroll_bar.cpp:481-483 "if (range <= 0) return 0")', () => {
    expect(scrollBarGrabberGeometry(false, BAR_LENGTH, THEME, 5, 5, 0, 0)).toEqual({ size: 0, offset: 0 });
  });

  it('honours a non-zero min — the range term is (max - min), not max alone', () => {
    // range = 100 - 50 = 50; page 25 covers half of it.
    const g = scrollBarGrabberGeometry(false, BAR_LENGTH, THEME, 50, 100, 25, 0);
    expect(g.size).toBe((25 / 50) * AREA_SIZE + GRABBER_MIN);
  });
});

describe('scrollBarTrackRect (scroll_bar.cpp:295-317)', () => {
  it('is the bar\'s own full rect — both icon terms are 0 in the default theme', () => {
    expect(scrollBarTrackRect({ x: 300, y: 40 })).toEqual({ x: 0, y: 0, w: 300, h: 40 });
  });
});

describe('scrollBarGrabberRect (scroll_bar.cpp:326-344)', () => {
  it('lays the grabber out along X for HORIZONTAL, spanning the full cross-axis height', () => {
    const grabber = { size: 50, offset: 20 };
    expect(scrollBarGrabberRect(false, { x: 300, y: 40 }, grabber)).toEqual({ x: 20, y: 0, w: 50, h: 40 });
  });

  it('lays the grabber out along Y for VERTICAL, spanning the full cross-axis width', () => {
    const grabber = { size: 50, offset: 20 };
    expect(scrollBarGrabberRect(true, { x: 40, y: 300 }, grabber)).toEqual({ x: 0, y: 20, w: 40, h: 50 });
  });
});
