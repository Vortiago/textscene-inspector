import { describe, expect, it } from 'vitest';
import { sprite2DEditRect } from './editRect';

// editRects.godot.test.ts holds the rects Godot printed. These cover the cases it does not.
describe('sprite2DEditRect', () => {
  it('takes 1x1 for a frame that rounds to nothing', () => {
    const props = {
      centered: false,
      offset: { x: 0, y: 0 },
      region_enabled: false,
      hframes: 4,
      vframes: 1,
      frame: 0,
    };
    expect(sprite2DEditRect({ width: 3, height: 0 }, props)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});
