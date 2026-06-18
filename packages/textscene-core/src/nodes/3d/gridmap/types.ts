/**
 * GridMap-specific type definitions.
 */

import type { Node3DProperties } from '../../base/node3d/types';
import type { Vector3 } from '../../../parser/vectors';

export interface GridMapProperties extends Node3DProperties {
  /** `mesh_library` reference (ExtResource / res://) to a MeshLibrary .tres. */
  meshLibrary?: string;
  /** Grid cell dimensions; Godot defaults to (2, 2, 2) when unset. */
  cellSize: Vector3;
  /** Raw `cells` PackedInt32Array body (int triplets), decoded by the component. */
  cells: string;
}
