/** SeparationRayShape3D decoded data. */

export interface SeparationRayShape3DProperties {
  /** Ray length along local +Z. `separation_ray_shape_3d.h:39`: `float length = 1.0`. */
  length: number;
  /** Whether the ray slides on slopes. `separation_ray_shape_3d.h:40`: `bool slide_on_slope = false`. */
  slideOnSlope: boolean;
}
