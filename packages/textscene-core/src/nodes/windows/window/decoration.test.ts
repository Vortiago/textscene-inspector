/**
 * Where `Viewport::_sub_window_update` (`viewport.cpp:342-401`) puts a window's title and close icon,
 * checked against the measured `Hello window` capture: a 300x200 window at (100, 120).
 */
import { describe, expect, it } from 'vitest';
import { OPEN_SANS_FONT_METRICS } from '../../../r3f/controls/native/text/openSansFontMetrics';
import { closeIconOrigin, shapeTitle, titleOrigin, titleSpace } from './decoration';

const WIDTH = 300;

describe('titleSpace', () => {
  it('leaves the width the border margins and the close offset do not take (`:363`)', () => {
    expect(titleSpace(WIDTH, { borderMinimumWidth: 20, closeHOffset: 18 })).toBe(262);
  });

  it('goes to zero or below for a window too narrow for a title', () => {
    expect(titleSpace(38, { borderMinimumWidth: 20, closeHOffset: 18 })).toBe(0);
  });
});

describe('titleOrigin', () => {
  it('centres the title over the window and in the title bar above it (`:368-369`)', () => {
    expect(titleOrigin(WIDTH, 36, { x: 104.5, y: 23 })).toEqual({ x: 97, y: -29 });
  });

  it('truncates both halves toward zero, as the int conversion does', () => {
    expect(titleOrigin(WIDTH, 36, { x: 103, y: 22.6 })).toEqual({ x: 98, y: -29 });
  });

  it('starts left of the window when the title is wider than it', () => {
    expect(titleOrigin(WIDTH, 36, { x: 311, y: 23 })).toEqual({ x: -5, y: -29 });
  });
});

describe('closeIconOrigin', () => {
  it('hangs the close icon from the top-right corner by its offsets (`:382-384`)', () => {
    expect(closeIconOrigin(WIDTH, { closeHOffset: 18, closeVOffset: 24 })).toEqual({ x: 282, y: -24 });
  });
});

describe('shapeTitle', () => {
  it('keeps a title with a newline on one line, as its one TextLine does (`viewport.cpp:374`)', () => {
    const shaped = shapeTitle('First\nSecond', 14, OPEN_SANS_FONT_METRICS);
    expect(shaped.lines).toHaveLength(1);
    expect(shaped.lines[0]!.glyphs.map((g) => g.char).join('')).toContain('Second');
  });
});
