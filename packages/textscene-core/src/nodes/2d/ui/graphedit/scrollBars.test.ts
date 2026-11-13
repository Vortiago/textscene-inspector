/**
 * `scrollBars.ts` versus `GraphEdit::_update_scrollbars` (`graph_edit.cpp:463-510`)
 * and `_notification(NOTIFICATION_READY)`'s own anchors (`:840-852`). Each
 * expected number is Godot's arithmetic worked by hand at theme scale 1.
 */
import { describe, expect, it } from 'vitest';
import { defaultScrollBarBoxes } from '../shared/testing/scrollBarBoxes';
import { graphEditConstructorScrollBars, graphEditScrollBars, hasUpdatedScrollBars } from './scrollBars';

const boxes = defaultScrollBarBoxes(1);
// One 120x64 GraphNode at (40, 56), zoom 1, in a 400x320 GraphEdit: the same
// box `minimap.test.ts` derives: min (-400, -320), max (560, 440).
const bounds = { min: { x: -400, y: -320 }, max: { x: 560, y: 440 } };
const size = { x: 400, y: 320 };

describe('graphEditScrollBars', () => {
  const bars = graphEditScrollBars(size, bounds, { x: 0, y: 0 }, boxes);

  it('shows both bars: the box is always the graph plus one GraphEdit rect each side (:491-492)', () => {
    // max - min = 960 > page 400 across, 760 > 320 down, so neither `hide()`
    // branch (:499,509) can be reached by a GraphEdit with a non-zero rect.
    expect(bars.horizontal.visible).toBe(true);
    expect(bars.vertical.visible).toBe(true);
  });

  it('anchors each bar to its own edge and dodges the other (graph_edit.cpp:844-851)', () => {
    // `style_h_scrollbar` pads (0,4,0,4) and the grabber (4,4,4,4)
    // (default_theme.cpp:543-545), so each bar's minimum is 8 across.
    expect(bars.horizontal.rect).toEqual({ x: 0, y: 312, w: 392, h: 8 });
    expect(bars.vertical.rect).toEqual({ x: 392, y: 0, w: 8, h: 312 });
  });

  it('sizes and places the horizontal grabber off page / range (scroll_bar.cpp:479-517)', () => {
    // area = 392 - 0 - 8 = 384; size = 400/960 * 384 + 8 = 168;
    // ratio = (0 + 400) / 960 so offset = 384 * 0.41666… = 160.
    expect(bars.horizontal.grabberRect.x).toBeCloseTo(160, 6);
    expect(bars.horizontal.grabberRect.w).toBeCloseTo(168, 6);
    expect(bars.horizontal.grabberRect.h).toBe(8);
  });

  it('sizes and places the vertical grabber the same way, transposed', () => {
    // area = 312 - 0 - 8 = 304; size = 320/760 * 304 + 8 = 136;
    // ratio = (0 + 320) / 760 so offset = 304 * 0.42105… = 128.
    expect(bars.vertical.grabberRect.y).toBeCloseTo(128, 6);
    expect(bars.vertical.grabberRect.h).toBeCloseTo(136, 6);
    expect(bars.vertical.grabberRect.w).toBe(8);
  });

  it('moves the grabber with scroll_offset, clamping the ratio to [0, 1] (range.cpp:308-324)', () => {
    const scrolled = graphEditScrollBars(size, bounds, { x: 560, y: 440 }, boxes);
    // value == max: ratio 1, so the grabber sits at the far end of its travel.
    expect(scrolled.horizontal.grabberRect.x).toBeCloseTo(384, 6);
    expect(scrolled.vertical.grabberRect.y).toBeCloseTo(304, 6);
  });

  it('hides both bars for a zero-extent GraphEdit, where range never exceeds page', () => {
    const degenerate = graphEditScrollBars(
      { x: 0, y: 0 },
      { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      { x: 0, y: 0 },
      boxes
    );
    expect(degenerate.horizontal.visible).toBe(false);
    expect(degenerate.vertical.visible).toBe(false);
  });
});

describe('hasUpdatedScrollBars (_update_scrollbars callers, graph_edit.cpp:414, :868, :1733, :2448)', () => {
  const none = {
    hasGraphElement: false,
    queuedScrollOffsetUpdate: false,
    outOfTreeSize: { x: 500, y: 280 },
    solvedSize: { x: 500, y: 280 },
  };

  it('holds when the GraphEdit has a GraphElement child', () => {
    expect(hasUpdatedScrollBars({ ...none, hasGraphElement: true })).toBe(true);
  });

  it('holds when a setter queued the update while the file loaded', () => {
    expect(hasUpdatedScrollBars({ ...none, queuedScrollOffsetUpdate: true })).toBe(true);
  });

  it('holds when the solved size differs from the size out of the tree (NOTIFICATION_RESIZED)', () => {
    expect(hasUpdatedScrollBars({ ...none, solvedSize: { x: 600, y: 300 } })).toBe(true);
  });

  it('does not hold when none of the three does', () => {
    expect(hasUpdatedScrollBars(none)).toBe(false);
  });
});

describe('graphEditConstructorScrollBars (graph_edit.cpp:3218-3222, :841-852)', () => {
  const bars = graphEditConstructorScrollBars({ x: 500, y: 280 }, boxes);

  it('gives each bar the full length of its edge, and the bars overlap in the corner', () => {
    expect(bars.horizontal.rect).toEqual({ x: 0, y: 272, w: 500, h: 8 });
    expect(bars.vertical.rect).toEqual({ x: 492, y: 0, w: 8, h: 280 });
    expect(bars.horizontal.visible).toBe(true);
    expect(bars.vertical.visible).toBe(true);
  });

  it('puts each grabber at the middle of its bar: value 0 in -10000 to 10000, page 0', () => {
    // The grabber is the 8 px minimum: area = 500 - 8 = 492, offset = 492 / 2 = 246.
    expect(bars.horizontal.grabberRect).toEqual({ x: 246, y: 0, w: 8, h: 8 });
    expect(bars.vertical.grabberRect).toEqual({ x: 0, y: 136, w: 8, h: 8 });
  });
});
