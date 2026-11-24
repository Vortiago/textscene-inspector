import { describe, expect, it } from 'vitest';
import {
  animatedSprite2DEditRect,
  meshInstance2DEditRect,
  path2DEditRect,
  sprite2DEditRect,
} from './nodeEditRects';

// nodeEditRects.godot.test.ts holds the rects Godot printed. These cover the cases it does not.
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

describe('animatedSprite2DEditRect', () => {
  it('has no rect without a frame texture', () => {
    expect(animatedSprite2DEditRect(undefined, true, { x: 0, y: 0 })).toBeNull();
  });

  it('centres the frame and keeps fractions', () => {
    expect(animatedSprite2DEditRect({ width: 15, height: 9 }, true, { x: 1, y: 0 })).toEqual({
      x: -6.5,
      y: -4.5,
      w: 15,
      h: 9,
    });
  });
});

describe('meshInstance2DEditRect', () => {
  it('reads the mesh box seen down its z axis', () => {
    const aabb = { position: { x: -15, y: -5, z: 0 }, size: { x: 30, y: 10, z: 0 } };
    expect(meshInstance2DEditRect(aabb)).toEqual({ x: -15, y: -5, w: 30, h: 10 });
  });
});

describe('path2DEditRect', () => {
  it('has no rect for no points', () => {
    expect(path2DEditRect([])).toBeNull();
  });
});
