/** `computeGridLines` and `computeGridDots` against `GraphEdit::_draw_grid` (`scene/gui/graph_edit.cpp:1895-1964`). */
import { describe, expect, it } from 'vitest';
import { computeGridDots, computeGridLines } from './grid';

describe('computeGridLines (GRID_PATTERN_LINES, graph_edit.cpp:1903-1929)', () => {
  it('one line every snapping_distance px, at zoom 1 with no scroll', () => {
    const lines = computeGridLines({ x: 100, y: 100 }, { x: 0, y: 0 }, 1, 20);
    const vertical = lines.filter((l) => l.axis === 'vertical').map((l) => l.at);
    const horizontal = lines.filter((l) => l.axis === 'horizontal').map((l) => l.at);
    expect(vertical).toEqual([0, 20, 40, 60, 80, 100]);
    expect(horizontal).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('marks only the multiple-of-10 index major (GRID_MINOR_STEPS_PER_MAJOR_LINE)', () => {
    const lines = computeGridLines({ x: 100, y: 100 }, { x: 0, y: 0 }, 1, 20);
    const vertical = lines.filter((l) => l.axis === 'vertical');
    expect(vertical.filter((l) => l.major).map((l) => l.at)).toEqual([0]);
  });

  it('shifts every line by scroll_offset (zoom 1: offset in graph space equals screen space)', () => {
    const lines = computeGridLines({ x: 100, y: 100 }, { x: 15, y: 0 }, 1, 20);
    const vertical = lines.filter((l) => l.axis === 'vertical').map((l) => l.at);
    expect(vertical).toEqual([-15, 5, 25, 45, 65, 85]);
  });

  it('divides scroll_offset AND rect size by zoom before flooring the cell range', () => {
    // offset = 40/2 = 20; fromX = floor(20/20) = 1. size = 200/2 = 100; lenX = floor(100/20)+1 = 6.
    const lines = computeGridLines({ x: 200, y: 200 }, { x: 40, y: 0 }, 2, 20);
    const vertical = lines.filter((l) => l.axis === 'vertical').map((l) => l.at);
    // at = i*20*2 - 20*2, i = 1..6
    expect(vertical).toEqual([0, 40, 80, 120, 160, 200]);
  });
});

describe('computeGridDots (GRID_PATTERN_DOTS, graph_edit.cpp:1930-1962)', () => {
  it('a minor dot at every cell EXCEPT one on a multiple-of-5 row AND column', () => {
    const { minor, major } = computeGridDots({ x: 40, y: 40 }, { x: 0, y: 0 }, 1, 20);
    // i,j both in [0..2]; only (0,0) is a multiple-of-5 pair, skipped from minor.
    expect(minor).not.toContainEqual({ x: 0, y: 0 });
    expect(minor).toContainEqual({ x: 20, y: 0 });
    expect(major).toContainEqual({ x: 0, y: 0 });
  });

  it('major dots start at `fromX - fromX % 5` (literal — JS `%` matches C++ int truncation here)', () => {
    // fromX = floor(-100/20) = -5, lenX = floor(20/20)+1 = 2. startI = -5 - (-5 % 5) = -5.
    // Loop i = -5 (i < fromX+lenX = -3, kept), then i = 0 (not < -3, stops) -> exactly one major column.
    const { major } = computeGridDots({ x: 20, y: 20 }, { x: -100, y: -100 }, 1, 20);
    expect(major).toEqual([{ x: 0, y: 0 }]);
  });
});
