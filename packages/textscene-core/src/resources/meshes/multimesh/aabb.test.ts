import { describe, expect, it } from 'vitest';
import { EMPTY_AABB, type Aabb } from '../../../godot/aabb';
import { multiMeshAabb } from './aabb';
import type { MultiMeshData } from './types';

const UNIT_CUBE: Aabb = { position: { x: -0.5, y: -0.5, z: -0.5 }, size: { x: 1, y: 1, z: 1 } };

function translation(x: number, y: number, z: number): number[] {
  return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
}

function multiMesh(fields: Partial<MultiMeshData>): MultiMeshData {
  return { customAabb: null, mesh: 'SubResource("mesh")', boundedTransforms: new Float32Array(0), ...fields };
}

describe('multiMeshAabb', () => {
  it('merges the mesh box under each bounded transform', () => {
    const transforms = new Float32Array([...translation(0, 0, 0), ...translation(4, 0, -2)]);
    expect(multiMeshAabb(multiMesh({ boundedTransforms: transforms }), UNIT_CUBE)).toEqual({
      position: { x: -0.5, y: -0.5, z: -2.5 },
      size: { x: 5, y: 1, z: 3 },
    });
  });

  it('is unknown while the mesh box the result needs is unknown', () => {
    const transforms = new Float32Array(translation(1, 2, 3));
    expect(multiMeshAabb(multiMesh({ boundedTransforms: transforms }), null)).toBeNull();
  });

  it('takes the custom box over the instances, with no mesh box needed', () => {
    const custom: Aabb = { position: { x: 1, y: 1, z: 1 }, size: { x: 2, y: 2, z: 2 } };
    const transforms = new Float32Array(translation(9, 9, 9));
    expect(multiMeshAabb(multiMesh({ customAabb: custom, boundedTransforms: transforms }), null)).toBe(
      custom
    );
  });

  it('is AABB() with no bounded transform', () => {
    expect(multiMeshAabb(multiMesh({}), null)).toBe(EMPTY_AABB);
  });
});
