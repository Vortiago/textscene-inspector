/**
 * Normalized view of a Godot MeshLibrary resource: a map from item id to the
 * ArrayMesh it points at plus that item's library-local mesh transform. Pure
 * data — the GridMap component turns `meshPath` into geometry (via the
 * ArrayMesh pipeline) and `meshTransform` into a THREE.Matrix4.
 */

import type { Transform3D } from '../../nodes/base/node3d/types';

export interface MeshLibraryItem {
  id: number;
  name?: string;
  /** Resolved `res://` path of the item's ArrayMesh, or null when absent. */
  meshPath: string | null;
  /** Library-local transform applied to the mesh, or null (= identity). */
  meshTransform: Transform3D | null;
}

/** item id → item. */
export type MeshLibraryModel = Map<number, MeshLibraryItem>;
