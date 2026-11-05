import type { Aabb } from '../../../godot/math/aabb.js';

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

/** One instance a MultiMesh draws: views into the decoded float data, not copies. */
export interface MultiMeshInstance {
  /**
   * The transform floats `multimesh_instance_set_transform_2d` writes, `[xx, xy, 0, ox, yx, yy, 0, oy]`
   * (`mesh_storage.cpp:1927-1934`), or the 12 of a 3D format: each basis row followed by its origin.
   */
  transform: Float32Array;
  /** The RGBA colour, or null when the MultiMesh does not `use_colors`. */
  color: Float32Array | null;
  /** The custom vector `INSTANCE_CUSTOM` reads, or null when the MultiMesh does not `use_custom_data`. */
  customData: Float32Array | null;
}

/** A MultiMesh's box data and the instances it draws. */
export interface DecodedMultiMesh extends MultiMeshData {
  /** `MultiMesh::TransformFormat`: a canvas draws only the 2D one (`renderer_canvas_render_rd.cpp:2775-2777`). */
  transformFormat: number;
  /**
   * The first `visible_instance_count` instances, or all of them for -1
   * (`mesh_storage.h:720-727`), in index order.
   */
  instances: readonly MultiMeshInstance[];
}
