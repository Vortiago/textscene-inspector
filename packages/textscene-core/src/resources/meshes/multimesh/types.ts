import type { Aabb } from '../../../godot/math/aabb.js';

/** Floats in one bounded transform: three basis rows, each with its origin component. */
export const TRANSFORM_FLOATS = 12;

/** The instances a MultiMesh draws, as the rendering server holds them after the loader's setters. */
export interface DrawnInstances {
  /** `MultiMeshTransformFormat`: 2D rows are 8 floats, 3D rows 12. */
  transformFormat: number;
  usesColors: boolean;
  usesCustomData: boolean;
  /** `visible_instance_count` when it is 0 or more, else `instance_count` (`mesh_storage.h:720-727`). */
  count: number;
  /**
   * The buffer of every instance, `instance_count` times the stride: the transform, then the colour
   * when `usesColors`, then the custom data when `usesCustomData`. Zeros where nothing set it.
   */
  buffer: Float32Array;
}

/** What a MultiMesh's box and its draw read, once the scene loader has set each property in file order. */
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
  drawn: DrawnInstances;
}

/** What a MultiMesh's box reads of it. */
export type MultiMeshBox = Pick<MultiMeshData, 'customAabb' | 'boundedTransforms'>;
