/** HeightMapShape3D decoded data. */

export interface HeightMapShape3DProperties {
  /** Samples along x. `height_map_shape_3d.h:41`: `int map_width = 2`. */
  width: number;
  /** Samples along z. `height_map_shape_3d.h:42`: `int map_depth = 2`. */
  depth: number;
  /** Row-major heights, `depth` rows of `width`: always `width * depth` long. */
  heights: Float32Array;
}
