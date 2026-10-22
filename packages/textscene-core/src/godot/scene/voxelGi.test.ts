import { describe, expect, it } from 'vitest';
import { VOXEL_GI_DEFAULTS, VOXEL_GI_SUBDIVISIONS, voxelGiSize } from './voxelGi';

describe('VOXEL_GI_DEFAULTS', () => {
  it('holds the constructor values: 20 on each side, and 128 subdivisions', () => {
    expect(VOXEL_GI_DEFAULTS).toEqual({ size: { x: 20, y: 20, z: 20 }, subdiv: 1 });
    expect(VOXEL_GI_SUBDIVISIONS[VOXEL_GI_DEFAULTS.subdiv]).toBe(128);
  });
});

describe('VOXEL_GI_SUBDIVISIONS', () => {
  it('holds the cell count of each enum value, as the gizmo reads them', () => {
    expect(VOXEL_GI_SUBDIVISIONS).toEqual([64, 128, 256, 512]);
  });
});

describe('voxelGiSize', () => {
  it('keeps a size of 1 or more', () => {
    expect(voxelGiSize({ x: 40, y: 10, z: 1 })).toEqual({ x: 40, y: 10, z: 1 });
  });

  it('raises each side below 1 to 1, on its own (edge case)', () => {
    expect(voxelGiSize({ x: 0.5, y: -3, z: 7 })).toEqual({ x: 1, y: 1, z: 7 });
  });
});
