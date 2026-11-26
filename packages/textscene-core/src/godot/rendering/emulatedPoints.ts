/** `point_coords` (`scene_forward_clustered.glsl:709`): the corner each vertex of an emulated point takes. */
export const POINT_CORNERS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 0],
  [1, 1],
  [0, 0],
  [1, 0],
  [1, 1],
];

/** The vertices of the quad an emulated point draws. */
export const QUAD_VERTICES = POINT_CORNERS.length;
