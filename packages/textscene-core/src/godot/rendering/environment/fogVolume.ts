/**
 * Godot 4.6.3's FogVolume in the volumetric fog: its shapes, and the froxels its compute pass
 * covers. Paths are under `servers/rendering/renderer_rd/environment/`.
 */

import { enumNamesByValue } from '../../classdb/enumNames.js';
import { clamp } from '../../math/math.js';
import type { HalfExtents, VolumetricFogGrid } from './volumetricFog.js';
import type { Vector3 } from '../../math/vector.js';

/** `RS::FogVolumeShape` (`servers/rendering_server.h`), the values `FogVolume.shape` stores. */
export enum FogVolumeShape {
  ELLIPSOID = 0,
  CONE = 1,
  CYLINDER = 2,
  BOX = 3,
  /** Covers every froxel, and ignores the size. */
  WORLD = 4,
}

/** Each shape's name by the integer a `.tscn` stores, as a validator names it. */
export const FOG_VOLUME_SHAPE_NAMES = enumNamesByValue(FogVolumeShape);

/** `FogVolume`'s defaults (`scene/3d/fog_volume.h:40-42`). */
export const FOG_VOLUME_DEFAULT_SIZE = { x: 2, y: 2, z: 2 } as const;
export const FOG_VOLUME_DEFAULT_SHAPE = FogVolumeShape.BOX;

/**
 * The fixed point each volume's density adds in: `DENSITY_SCALE` (`shaders/environment/volumetric_fog.glsl:13`).
 * A volume adds `int(density * 1024)`, so a density under 1/1024 adds nothing.
 */
export const FOG_VOLUME_DENSITY_SCALE = 1024;

/** `size.maxf(0)`: the setter clamps each component (`scene/3d/fog_volume.cpp:78`). */
export function fogVolumeSize({ x, y, z }: Vector3): Vector3 {
  return { x: Math.max(0, x), y: Math.max(0, y), z: Math.max(0, z) };
}

/** The volumetric fog of one view, as a volume's corners find their cells in it. */
export interface FogVolumeFrame {
  grid: VolumetricFogGrid;
  /** The half extents of the fog's first and last slices. */
  begin: HalfExtents;
  end: HalfExtents;
  length: number;
  detailSpread: number;
}

/** The cells a volume's pass covers, from `min` to before `max`, with rows counted from the top. */
export interface FroxelRange {
  min: Vector3;
  max: Vector3;
}

/** A point clamped in front of the camera, so a corner behind it maps to the first slice. */
const VIEW_DEPTH_MAX = -0.01;

/**
 * The cell holding the view-space point `view`, with rows counted from the top, clamped to the grid
 * and one past it (`fog.cpp:551-567`). The sections spread linearly in depth here, unlike the slices.
 */
export function fogVolumeFroxel(
  view: Vector3,
  { grid, begin, end, length, detailSpread }: FogVolumeFrame
): Vector3 {
  const depth = -Math.min(view.z, VIEW_DEPTH_MAX) / length;
  const x = view.x / (2 * (begin.x * (1 - depth) + end.x * depth)) + 0.5;
  const y = -view.y / (2 * (begin.y * (1 - depth) + end.y * depth)) + 0.5;
  const z = depth ** (1 / detailSpread);
  return {
    x: Math.trunc(clamp(x * grid.width - 0.5, 0, grid.width)),
    y: Math.trunc(clamp(y * grid.height - 0.5, 0, grid.height)),
    z: Math.trunc(clamp(z * grid.depth - 0.5, 0, grid.depth)),
  };
}

/**
 * The cells a local volume's pass covers, given its corners' cells (`fog.cpp:685-718`). The range
 * ends at the farthest corner's cell, so that cell stays empty. A camera near the volume covers the
 * whole screen up to that cell.
 */
export function fogVolumeFroxelRange(
  corners: readonly Vector3[],
  { isCameraInside, grid }: { isCameraInside: boolean; grid: VolumetricFogGrid }
): FroxelRange {
  const farthest = Math.max(1, ...corners.map((corner) => corner.z));
  if (isCameraInside)
    return { min: { x: 0, y: 0, z: 0 }, max: { x: grid.width, y: grid.height, z: farthest } };
  const min = { x: grid.width - 1, y: grid.height - 1, z: grid.depth - 1 };
  const max = { x: 1, y: 1, z: 1 };
  for (const corner of corners) {
    min.x = Math.min(min.x, corner.x);
    min.y = Math.min(min.y, corner.y);
    min.z = Math.min(min.z, corner.z);
    max.x = Math.max(max.x, corner.x);
    max.y = Math.max(max.y, corner.y);
    max.z = Math.max(max.z, corner.z);
  }
  return { min, max };
}

/**
 * Whether the camera lies within the bounds of a volume's world corners, grown by the distance to
 * its near plane's corner. Its near plane may then cut the volume, so the pass covers the whole
 * screen (`fog.cpp:701-707`).
 */
export function isCameraNearFogVolume(
  camera: Vector3,
  corners: readonly Vector3[],
  nearCornerDistance: number
): boolean {
  return (['x', 'y', 'z'] as const).every((axis) => {
    const values = corners.map((corner) => corner[axis]);
    return (
      camera[axis] > Math.min(...values) - nearCornerDistance &&
      camera[axis] < Math.max(...values) + nearCornerDistance
    );
  });
}
