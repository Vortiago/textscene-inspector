import { describe, expect, it } from 'vitest';
import { VOXEL_GI_DEFAULTS, VOXEL_GI_SUBDIV_NAMES, voxelGiCells, voxelGiSize } from './voxelGi';

describe('VOXEL_GI_SUBDIV_NAMES', () => {
  it('names the four subdivisions, SUBDIV_MAX left out (voxel_gi.h:101-108)', () => {
    expect(VOXEL_GI_SUBDIV_NAMES).toEqual({
      0: 'SUBDIV_64',
      1: 'SUBDIV_128',
      2: 'SUBDIV_256',
      3: 'SUBDIV_512',
    });
  });
});

describe('VOXEL_GI_DEFAULTS', () => {
  it('holds the constructor values: 20 on each side, and 128 subdivisions', () => {
    expect(VOXEL_GI_DEFAULTS).toEqual({ size: { x: 20, y: 20, z: 20 }, subdiv: 1 });
    expect(voxelGiCells(VOXEL_GI_DEFAULTS.subdiv)).toBe(128);
  });
});

describe('voxelGiCells', () => {
  it('gives the cell count of each enum value, as the gizmo reads them', () => {
    expect([0, 1, 2, 3].map(voxelGiCells)).toEqual([64, 128, 256, 512]);
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
