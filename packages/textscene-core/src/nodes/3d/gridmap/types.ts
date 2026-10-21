/** GridMap node data. */

import type { Node3DProperties } from '../../base/node3d/types';
import type { Vector3 } from '../../../godot/math/vector';

export interface GridMapProperties extends Node3DProperties {
  /** `mesh_library` reference (ExtResource / res://) to a MeshLibrary .tres. */
  meshLibrary?: string;
  /** Grid cell dimensions; Godot defaults to (2, 2, 2) when unset. */
  cellSize: Vector3;
  /**
   * Per-axis `cell_center_x/y/z`. Godot defaults every axis to true, which
   * offsets each cell by half a cell on that axis.
   */
  cellCenter: { x: boolean; y: boolean; z: boolean };
  /** Raw `cells` PackedInt32Array body (int triplets), decoded by the component. */
  cells: string;
  /** Each `baked_meshes` reference, in index order. While any is set, they draw in place of the cells. */
  bakedMeshes: string[];
}
