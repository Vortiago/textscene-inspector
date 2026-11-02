/**
 * `castTargetLine` and `isZeroTarget`: the origin→target line the two cast nodes' gizmos share
 * (ray_cast_3d.cpp:411-412, shape_cast_3d.cpp:518-520), and the zero target both vertex builders
 * return before any vertex on (ray_cast_3d.cpp:407-409).
 */
import { describe, expect, it } from 'vitest';
import { castTargetLine, isZeroTarget } from './castTarget';

describe('castTargetLine', () => {
  it('writes the two ends the Godot vertex pair holds', () => {
    expect(castTargetLine({ x: 0, y: -3, z: 2 })).toEqual(new Float32Array([0, 0, 0, 0, -3, 2]));
  });

  it('gives null at the zero target, so the gizmo mounts no line object', () => {
    expect(castTargetLine({ x: 0, y: 0, z: 0 })).toBeNull();
  });

  it('reads a signed zero as the zero vector, as Godot compares it', () => {
    expect(isZeroTarget({ x: -0, y: 0, z: -0 })).toBe(true);
    expect(isZeroTarget({ x: 1, y: 0, z: 0 })).toBe(false);
  });
});
