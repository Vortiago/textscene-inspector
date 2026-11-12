import type { Aabb } from '../../../godot/math/aabb.js';

/** Floats in one bounded transform: three basis rows, each with its origin component. */
export const TRANSFORM_FLOATS = 12;

/** Floats in one 2D buffer transform: the x and y rows, each with its origin component. */
const TRANSFORM_2D_FLOATS = 8;

/** Floats in an instance's colour and in its custom data. */
export const VEC4_FLOATS = 4;

/** Floats in one instance matrix of a draw. */
export const MATRIX_FLOATS = 16;

/** Where each part of an instance sits in its buffer row (`mesh_storage.cpp:1543-1598`). */
export interface InstanceLayout {
  stride: number;
  colourOffset: number;
  customOffset: number;
}

/** The row layout of a MultiMesh buffer: the transform, then the colour and the custom data when used. */
export function instanceLayout(is3D: boolean, usesColors: boolean, usesCustomData: boolean): InstanceLayout {
  const colourOffset = is3D ? TRANSFORM_FLOATS : TRANSFORM_2D_FLOATS;
  const customOffset = colourOffset + (usesColors ? VEC4_FLOATS : 0);
  return { stride: customOffset + (usesCustomData ? VEC4_FLOATS : 0), colourOffset, customOffset };
}

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
   * when `usesColors`, then the custom data when `usesCustomData`. Null when nothing set it, which
   * reads as zeros: a decode that only reads the box never allocates `instance_count` rows.
   */
  buffer: Float32Array | null;
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

/** One instance a MultiMesh draws: views into the drawn buffer, not copies. */
export interface MultiMeshInstance {
  /**
   * The transform floats of the buffer row, `[xx, xy, 0, ox, yx, yy, 0, oy]` for a 2D format
   * (`mesh_storage.cpp:1927-1934`) or the 12 of a 3D one: each basis row followed by its origin.
   */
  transform: Float32Array;
  /** The RGBA colour, or null when the MultiMesh does not `use_colors`. */
  color: Float32Array | null;
  /** The custom vector `INSTANCE_CUSTOM` reads, or null when the MultiMesh does not `use_custom_data`. */
  customData: Float32Array | null;
}
