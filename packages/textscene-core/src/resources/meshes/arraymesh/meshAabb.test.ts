import { describe, expect, it } from 'vitest';
import { EMPTY_AABB } from '../../../godot/aabb';
import { arrayMeshAabb } from './meshAabb';

const surface = (aabb: string) => `{ "aabb": ${aabb}, "format": 34359742465, "primitive": 3 }`;

describe('arrayMeshAabb', () => {
  it("merges the surfaces' stored boxes", () => {
    const box = arrayMeshAabb({
      _surfaces: `[${surface('AABB(-1, 0, 0, 1, 1, 1)')}, ${surface('AABB(0, 0, 0, 2, 3, 1)')}]`,
    });
    expect(box).toEqual({ position: { x: -1, y: 0, z: 0 }, size: { x: 3, y: 3, z: 1 } });
  });

  it('takes custom_aabb over the surfaces', () => {
    const box = arrayMeshAabb({
      custom_aabb: 'AABB(0, 0, 0, 5, 5, 5)',
      _surfaces: `[${surface('AABB(-1, 0, 0, 1, 1, 1)')}]`,
    });
    expect(box.size).toEqual({ x: 5, y: 5, z: 5 });
  });

  it('reads a surface with no stored box as AABB() (error case)', () => {
    expect(arrayMeshAabb({ _surfaces: '[{ "format": 1 }]' })).toEqual(EMPTY_AABB);
  });

  it('gives a mesh with no surfaces AABB() (edge case)', () => {
    expect(arrayMeshAabb({})).toBe(EMPTY_AABB);
  });
});
