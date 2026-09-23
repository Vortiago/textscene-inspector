import { describe, expect, it } from 'vitest';
import { triplanarPlaneScale } from './triplanarScale';
import type { TscnInternalResource } from '../../../parser/types';

const mesh = (type: string, data: Record<string, string>): TscnInternalResource => ({
  id: 'm',
  type,
  data,
});

describe('triplanarPlaneScale', () => {
  it('PlaneMesh tiles per world unit: repeat = size × uv1_scale (default scale)', () => {
    // A 12×3.5 plane, world triplanar, default uv1_scale: Godot tiles it 12×3.5 times.
    const s = triplanarPlaneScale(mesh('PlaneMesh', { size: 'Vector2(12, 3.5)' }), { x: 1, y: 1 });
    expect(s).toEqual({ x: 12, y: 3.5 });
  });

  it('folds a sub-unit uv1_scale into the tiling (ceiling: 0.5 → half as many tiles)', () => {
    const s = triplanarPlaneScale(mesh('PlaneMesh', { size: 'Vector2(12, 3.5)' }), {
      x: 0.5,
      y: 0.5,
    });
    expect(s).toEqual({ x: 6, y: 1.75 });
  });

  it('non-planar meshes fall back to the base scale unchanged (no planar size to use)', () => {
    const base = { x: 2, y: 2 };
    expect(triplanarPlaneScale(mesh('BoxMesh', { size: 'Vector3(1, 1, 1)' }), base)).toBe(base);
  });

  it("defaults to Godot's 2×2 PlaneMesh size when size is absent", () => {
    const s = triplanarPlaneScale(mesh('PlaneMesh', {}), { x: 1, y: 1 });
    expect(s).toEqual({ x: 2, y: 2 });
  });
});
