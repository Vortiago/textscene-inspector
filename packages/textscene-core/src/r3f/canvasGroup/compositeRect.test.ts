import { describe, expect, it } from 'vitest';
import { compositeRect } from './compositeRect';

const CLIP = { x: 0, y: 0, w: 1152, h: 648 };
const RED = { x: 0, y: 0, w: 100, h: 100 };
const BLUE = { x: 50, y: 50, w: 100, h: 100 };

describe('compositeRect', () => {
  it('is null with no drawn item, so the group draws nothing (renderer_canvas_cull.cpp:206)', () => {
    expect(compositeRect([], CLIP, 10)).toBeNull();
  });

  it('merges the drawn rects and grows them by fit_margin', () => {
    expect(compositeRect([RED, BLUE], CLIP, 10)).toEqual({ x: -10, y: -10, w: 170, h: 170 });
  });

  it('is the merge itself at fit_margin 0', () => {
    expect(compositeRect([RED, BLUE], CLIP, 0)).toEqual({ x: 0, y: 0, w: 150, h: 150 });
  });

  it('grows a 1x1 rect at the origin when the merge is the empty Rect2 (renderer_canvas_cull.cpp:223-225)', () => {
    expect(compositeRect([{ x: 0, y: 0, w: 0, h: 0 }], CLIP, 10)).toEqual({ x: -10, y: -10, w: 21, h: 21 });
  });

  it('leaves out an item outside the clip, which Godot never lists (renderer_canvas_cull.cpp:259)', () => {
    expect(compositeRect([RED, { x: 2000, y: 0, w: 10, h: 10 }], CLIP, 0)).toEqual(RED);
  });

  it('keeps an item that only touches the clip, as borders count', () => {
    const touching = { x: 1152, y: 0, w: 10, h: 10 };
    expect(compositeRect([touching], CLIP, 0)).toEqual(touching);
  });
});
