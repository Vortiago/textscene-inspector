/**
 * The MeshLibrary slice's types: a map from item id to the ArrayMesh it points
 * at plus that item's library-local mesh transform. Pure data: the GridMap
 * component turns `meshPath` into geometry (through the ArrayMesh pipeline) and
 * `meshTransform` into a THREE.Matrix4.
 */

import type { Transform3D } from '../../nodes/base/node3d/types';

/** Godot `RS::ShadowCastingSetting` (`servers/rendering/rendering_server.h:1494-1499`). */
export enum ShadowCastingSetting {
  OFF = 0,
  ON = 1,
  DOUBLE_SIDED = 2,
  SHADOWS_ONLY = 3,
}

export interface MeshLibraryItem {
  id: number;
  name?: string;
  /** Resolved `res://` path of the item's ArrayMesh, or null when absent. */
  meshPath: string | null;
  /** Library-local transform applied to the mesh, or null (= identity). */
  meshTransform: Transform3D | null;
  /** Per-tile shadow casting, which GridMap applies per instance (`modules/gridmap/grid_map.cpp:799`). */
  castShadow: ShadowCastingSetting;
}

/** item id → item. */
export type MeshLibraryModel = Map<number, MeshLibraryItem>;
