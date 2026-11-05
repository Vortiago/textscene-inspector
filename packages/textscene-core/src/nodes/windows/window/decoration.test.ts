/**
 * Where `Viewport::_sub_window_update` (`viewport.cpp:342-401`) puts a window's title and close icon,
 * checked against the measured `Hello window` capture: a 300x200 window at (100, 120).
 */
import { describe, expect, it } from 'vitest';
import { closeIconOrigin, titleOrigin, titleSpace } from './decoration';

const rect = { x: 100, y: 120, w: 300, h: 200 };

describe('titleSpace', () => {
  it('leaves the width the border margins and the close offset do not take (`:363`)', () => {
    expect(titleSpace(rect.w, { borderMinimumWidth: 20, closeHOffset: 18 })).toBe(262);
  });

  it('goes to zero or below for a window too narrow for a title', () => {
    expect(titleSpace(38, { borderMinimumWidth: 20, closeHOffset: 18 })).toBe(0);
  });
});

describe('titleOrigin', () => {
  it('centres the title over the window and in the title bar above it (`:368-369`)', () => {
    expect(titleOrigin(rect, 36, { x: 104.5, y: 23 })).toEqual({ x: 197, y: 91 });
  });

  it('truncates both halves toward zero, as the int conversion does', () => {
    expect(titleOrigin(rect, 36, { x: 103, y: 22.6 })).toEqual({ x: 198, y: 91 });
  });

  it('starts left of the window when the title is wider than it', () => {
    expect(titleOrigin(rect, 36, { x: 311, y: 23 })).toEqual({ x: 95, y: 91 });
  });
});

describe('closeIconOrigin', () => {
  it('hangs the close icon from the top-right corner by its offsets (`:382-384`)', () => {
    expect(closeIconOrigin(rect, { closeHOffset: 18, closeVOffset: 24 })).toEqual({ x: 382, y: 96 });
  });
});
