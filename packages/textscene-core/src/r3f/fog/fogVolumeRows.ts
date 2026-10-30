/**
 * The FogVolumes the volumetric fog draws, packed for the light pass as Godot's volume pass binds
 * each one (`environment/fog.cpp:625-770`): the map from view space into the volume, its shape, the
 * froxels its pass covers, and what fills it. One row of texels per volume.
 */

import * as THREE from 'three';
import {
  FogVolumeShape,
  fogVolumeFroxel,
  fogVolumeFroxelRange,
  isCameraNearFogVolume,
  type FogVolumeFrame,
  type FroxelRange,
} from '../../godot/rendering/environment/fogVolume.js';
import { setGodotColorLinear } from '../godotColor.js';
import { visibleInTree } from '../visibleInTree.js';
import type { FogDensityAtlas } from './fogDensityAtlas.js';
import type { FogVolumeObject } from './fogVolumeObject.js';
import { RowBuffer } from '../rowTexture/packedRows.js';
import { writeVec4 } from '../writeVec4.js';
import { cameraFrustum } from '../cameraFrustum.js';

/**
 * Where each value sits in a volume's row, in texels of four floats. `TO_LOCAL` starts three rows
 * of the map from view space into the volume. `HEIGHT` takes a view point to its height above the
 * volume's origin. `SHAPE` holds the size and the shape, and `MATERIAL` the density, the height
 * falloff, the edge fade and the kind. `DENSITY_TEXTURE` holds the size and first slice of the
 * density texture's region in the atlas, all zero for none. The froxel range counts rows from the
 * top, as Godot's does.
 */
export const FogVolumeTexel = {
  TO_LOCAL: 0,
  HEIGHT: 3,
  SHAPE: 4,
  FROXEL_MIN: 5,
  FROXEL_MAX: 6,
  MATERIAL: 7,
  ALBEDO: 8,
  EMISSION: 9,
  DENSITY_TEXTURE: 10,
} as const;

/** The texels in each row. */
export const FOG_VOLUME_TEXELS = FogVolumeTexel.DENSITY_TEXTURE + 1;

const ROW_LENGTH = FOG_VOLUME_TEXELS * 4;

/** The kind in a row's material texel, which the fog shader branches on. */
export const FogVolumeKind = {
  DEFAULT: 0,
  MATERIAL: 1,
} as const;

/** The volumetric fog of one view, and the distance from its camera to its near plane's corner. */
export interface FogVolumeView extends FogVolumeFrame {
  nearCornerDistance: number;
}

/** The unit cube's corners, which the size scales into a volume's local corners. */
const UNIT_CORNERS = [-0.5, 0.5].flatMap((x) =>
  [-0.5, 0.5].flatMap((y) => [-0.5, 0.5].map((z) => new THREE.Vector3(x, y, z)))
);

/** Scratch for one row, overwritten by each volume. */
const row = new Float32Array(ROW_LENGTH);
const viewToLocal = new THREE.Matrix4();
const cameraPosition = new THREE.Vector3();
const bounds = new THREE.Box3();
const frustum = new THREE.Frustum();
const color = new THREE.Color();
const worldCorners = UNIT_CORNERS.map(() => new THREE.Vector3());
const viewCorner = new THREE.Vector3();

/** The rows of every visible volume the fog draws, rewritten in place by each `pack`. */
export class FogVolumeRows extends RowBuffer {
  constructor() {
    super(ROW_LENGTH);
  }

  /**
   * Packs `volumes` as `camera` sees them in `view`'s fog, with their density textures' regions in
   * `atlas`, and answers whether any row changed.
   */
  pack(
    volumes: readonly FogVolumeObject[],
    camera: THREE.Camera,
    view: FogVolumeView,
    atlas: FogDensityAtlas
  ): boolean {
    cameraFrustum(camera, frustum);
    this.begin();
    for (const volume of volumes) {
      if (visibleInTree(volume) && writeRow(volume, camera, view, atlas)) this.append(row);
    }
    return this.finish();
  }
}

/** Writes `volume`'s row into the scratch row, or answers false for a volume the fog skips. */
function writeRow(
  volume: FogVolumeObject,
  camera: THREE.Camera,
  view: FogVolumeView,
  atlas: FogDensityAtlas
): boolean {
  const { fill } = volume;
  if (fill.kind === 'shader') return false;
  const isWorld = volume.shape === FogVolumeShape.WORLD;
  // Only a WORLD volume ignores culling (`scene/3d/fog_volume.cpp:90`).
  if (!isWorld && !frustum.intersectsBox(worldBounds(volume))) return false;
  const range = isWorld ? wholeGrid(view) : coveredFroxels(volume, camera, view);
  if (range.max.x <= range.min.x || range.max.y <= range.min.y || range.max.z <= range.min.z) return false;
  row.fill(0);
  writeTransforms(volume, camera);
  // A WORLD volume's size is twice the grid's, its extents the grid (`environment/fog.cpp:723`).
  const { x, y, z } = isWorld
    ? { x: view.grid.width * 2, y: view.grid.height * 2, z: view.grid.depth * 2 }
    : volume.size;
  writeVec4(row, FogVolumeTexel.SHAPE, x, y, z, volume.shape);
  writeVec4(row, FogVolumeTexel.FROXEL_MIN, range.min.x, range.min.y, range.min.z);
  writeVec4(row, FogVolumeTexel.FROXEL_MAX, range.max.x, range.max.y, range.max.z);
  if (fill.kind === 'default') {
    writeVec4(row, FogVolumeTexel.MATERIAL, 1, 0, 0, FogVolumeKind.DEFAULT);
    writeVec4(row, FogVolumeTexel.ALBEDO, 1, 1, 1);
    return true;
  }
  const { density, heightFalloff, edgeFade, albedo, emission } = fill.material;
  writeVec4(row, FogVolumeTexel.MATERIAL, density, heightFalloff, edgeFade, FogVolumeKind.MATERIAL);
  // `source_color` turns both colours linear (`fog_material.cpp:152-153`).
  setGodotColorLinear(color, albedo);
  writeVec4(row, FogVolumeTexel.ALBEDO, color.r, color.g, color.b);
  setGodotColorLinear(color, emission);
  writeVec4(row, FogVolumeTexel.EMISSION, color.r, color.g, color.b);
  const region = fill.densityTexture && atlas.regionOf(fill.densityTexture);
  if (region)
    writeVec4(row, FogVolumeTexel.DENSITY_TEXTURE, region.width, region.height, region.depth, region.zStart);
  return true;
}

/**
 * The map from view space into the volume, and the height row: a view point's world height less
 * the volume's origin's, the fog shader's `WORLD_POSITION.y - OBJECT_POSITION.y`.
 */
function writeTransforms(volume: FogVolumeObject, camera: THREE.Camera): void {
  viewToLocal.copy(volume.matrixWorld).invert().multiply(camera.matrixWorld);
  const local = viewToLocal.elements;
  for (let axis = 0; axis < 3; axis++) {
    writeVec4(
      row,
      FogVolumeTexel.TO_LOCAL + axis,
      local[axis]!,
      local[axis + 4]!,
      local[axis + 8]!,
      local[axis + 12]!
    );
  }
  const world = camera.matrixWorld.elements;
  writeVec4(
    row,
    FogVolumeTexel.HEIGHT,
    world[1]!,
    world[5]!,
    world[9]!,
    world[13]! - volume.matrixWorld.elements[13]!
  );
}

/** The world box around the volume's corners, which Godot culls its instance by. */
function worldBounds(volume: FogVolumeObject): THREE.Box3 {
  return bounds.setFromPoints(worldCornersOf(volume));
}

function worldCornersOf(volume: FogVolumeObject): THREE.Vector3[] {
  UNIT_CORNERS.forEach((unit, i) =>
    worldCorners[i]!.copy(unit).multiply(volume.size).applyMatrix4(volume.matrixWorld)
  );
  return worldCorners;
}

function coveredFroxels(volume: FogVolumeObject, camera: THREE.Camera, view: FogVolumeView): FroxelRange {
  const corners = worldCornersOf(volume);
  const froxels = corners.map((corner) =>
    fogVolumeFroxel(viewCorner.copy(corner).applyMatrix4(camera.matrixWorldInverse), view)
  );
  cameraPosition.setFromMatrixPosition(camera.matrixWorld);
  const isCameraInside = isCameraNearFogVolume(cameraPosition, corners, view.nearCornerDistance);
  return fogVolumeFroxelRange(froxels, { isCameraInside, grid: view.grid });
}

function wholeGrid({ grid }: FogVolumeView): FroxelRange {
  return { min: { x: 0, y: 0, z: 0 }, max: { x: grid.width, y: grid.height, z: grid.depth } };
}
