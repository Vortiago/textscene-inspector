/**
 * The froxels a FogVolume rasterises into, against the cells Godot 4.6.3's
 * `Fog::volumetric_fog_update` dispatches (`environment/fog.cpp:551-570`, `:685-740`).
 */
import { describe, expect, it } from 'vitest';
import {
  fogVolumeFroxel,
  fogVolumeFroxelRange,
  isCameraNearFogVolume,
  type FogVolumeFrame,
} from './fogVolume';

/** A 64×32×64 grid over a 40-unit fog whose sections grow from 0.1 to 20 by 10 units across. */
const FRAME: FogVolumeFrame = {
  grid: { width: 64, height: 32, depth: 64 },
  begin: { x: 0.1, y: 0.05 },
  end: { x: 20, y: 10 },
  length: 40,
  detailSpread: 1,
};

describe('fogVolumeFroxel', () => {
  it('places the middle of the fog in the middle cell', () => {
    // z 0.5 spans 10.05 by 5.025 there, so x and y land at 0.5 of the grid, less half a cell.
    expect(fogVolumeFroxel({ x: 0, y: 0, z: -20 }, FRAME)).toEqual({ x: 31, y: 15, z: 31 });
  });

  it('counts rows from the top, as Godot does', () => {
    // At the fog's end the upper section edge is y = 10, which maps to row 0.
    expect(fogVolumeFroxel({ x: 0, y: 10, z: -40 }, FRAME).y).toBe(0);
  });

  it('packs the depth towards the camera under a detail spread above 1', () => {
    // z 0.25 of the length under spread 2 is the unit depth 0.5, the middle slice.
    expect(fogVolumeFroxel({ x: 0, y: 0, z: -10 }, { ...FRAME, detailSpread: 2 }).z).toBe(31);
  });

  it('clamps a point behind the camera to the first slice (edge case)', () => {
    expect(fogVolumeFroxel({ x: 0, y: 0, z: 5 }, FRAME).z).toBe(0);
  });

  it('clamps a point past the fog to the grid size, one past the last cell (edge case)', () => {
    expect(fogVolumeFroxel({ x: 0, y: 0, z: -400 }, FRAME).z).toBe(64);
  });
});

describe('fogVolumeFroxelRange', () => {
  const near = { x: 20, y: 10, z: 12 };
  const far = { x: 40, y: 20, z: 30 };

  it('spans the corners of a volume the camera is outside, with the far cells excluded', () => {
    expect(fogVolumeFroxelRange([near, far], { isCameraInside: false, grid: FRAME.grid })).toEqual({
      min: near,
      max: far,
    });
  });

  it('keeps the first cell of a volume whose corners all clamp to it, from the end Godot seeds (edge case)', () => {
    const origin = { x: 0, y: 0, z: 0 };
    expect(fogVolumeFroxelRange([origin], { isCameraInside: false, grid: FRAME.grid })).toEqual({
      min: origin,
      max: { x: 1, y: 1, z: 1 },
    });
  });

  it('spans the whole screen up to the farthest corner when the camera is near the volume', () => {
    expect(fogVolumeFroxelRange([near, far], { isCameraInside: true, grid: FRAME.grid })).toEqual({
      min: { x: 0, y: 0, z: 0 },
      max: { x: 64, y: 32, z: 30 },
    });
  });
});

describe('isCameraNearFogVolume', () => {
  const corners = [
    { x: -1, y: 0, z: -6 },
    { x: 1, y: 2, z: -4 },
  ];

  it("holds for a camera inside the corners' bounds", () => {
    expect(isCameraNearFogVolume({ x: 0, y: 1, z: -5 }, corners, 0.1)).toBe(true);
  });

  it('holds for a camera outside the bounds by less than its near corner (edge case)', () => {
    expect(isCameraNearFogVolume({ x: 0, y: 1, z: -3.95 }, corners, 0.1)).toBe(true);
  });

  it('fails for a camera farther out than its near corner', () => {
    expect(isCameraNearFogVolume({ x: 0, y: 3, z: 8 }, corners, 0.1)).toBe(false);
  });
});
