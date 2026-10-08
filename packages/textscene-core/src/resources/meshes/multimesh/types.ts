import type { Aabb } from '../../../godot/aabb.js';

/** What a MultiMesh's box reads, once the scene loader has set each property in file order. */
export interface MultiMeshData {
  /** `custom_aabb`, or null for `AABB()`, which the server takes as none. */
  customAabb: Aabb | null;
  /** The `mesh` reference, or undefined for none. */
  mesh: string | undefined;
  /**
   * Each instance transform the server's box bounds, as 12 floats: each basis row followed by its
   * origin component. Empty when the box is `AABB()`.
   */
  boundedTransforms: Float32Array;
}
