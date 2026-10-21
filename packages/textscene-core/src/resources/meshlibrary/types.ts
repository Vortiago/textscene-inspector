/**
 * The MeshLibrary slice's types: a map from item id to the mesh it points at plus
 * that item's library-local mesh transform. Pure data: the GridMap component turns
 * `meshPath` into geometry and `meshTransform` into a THREE.Matrix4.
 */

import type { Transform3D } from '../../godot/math/transform3d';
import { ShadowCastingSetting } from '../../godot/rendering/rendering';

/** Godot's `RS::ShadowCastingSetting`, shared with every GeometryInstance3D. */
export { ShadowCastingSetting };

export interface MeshLibraryItem {
  id: number;
  name?: string;
  /**
   * The item's mesh as a `res://` path or a **Sub-resource path** into the library. Null when the
   * item has no mesh, which Godot draws nothing for.
   */
  meshPath: string | null;
  /** Library-local transform applied to the mesh, or null (= identity). */
  meshTransform: Transform3D | null;
  /** Per-tile shadow casting, which GridMap applies per instance (`modules/gridmap/grid_map.cpp:799`). */
  castShadow: ShadowCastingSetting;
}

/** item id → item. */
export type MeshLibraryModel = Map<number, MeshLibraryItem>;
