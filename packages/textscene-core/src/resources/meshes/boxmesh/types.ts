/** BoxMesh decoded data. */

import type { Vector3 } from '../../../parser/vectors';

export interface BoxMeshProperties {
  /** Box size. `primitive_meshes.h:164`: `Vector3 size = Vector3(1, 1, 1)`. */
  size: Vector3;
  /** Extra edge loops per axis (Godot default 0 → 1 face segment). */
  subdivideWidth: number;
  subdivideHeight: number;
  subdivideDepth: number;
}
