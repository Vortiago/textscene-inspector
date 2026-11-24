import { describe, expect, it } from 'vitest';
import { meshInstance2DEditRect } from './editRect';

describe('meshInstance2DEditRect', () => {
  it('reads the mesh box seen down its z axis', () => {
    const aabb = { position: { x: -15, y: -5, z: 0 }, size: { x: 30, y: 10, z: 0 } };
    expect(meshInstance2DEditRect(aabb)).toEqual({ x: -15, y: -5, w: 30, h: 10 });
  });
});
