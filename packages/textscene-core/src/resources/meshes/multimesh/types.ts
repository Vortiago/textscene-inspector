import type { Aabb } from '../../../godot/aabb.js';

/** Floats in one bounded transform: three basis rows, each with its origin component. */
export const TRANSFORM_FLOATS = 12;

/** What a MultiMesh's box reads, once the scene loader has set each property in file order. */
export interface MultiMeshData {
  /** `custom_aabb`, or null for `AABB()`, which the server takes as none. */
  customAabb: Aabb | null;
  /** The `mesh` reference, or undefined for none. */
  mesh: string | undefined;
  /**
   * Each instance transform the server's box bounds, as `TRANSFORM_FLOATS` floats: each basis row followed by its
   * origin component. Empty when the box is `AABB()`.
   */
  boundedTransforms: Float32Array;
}
