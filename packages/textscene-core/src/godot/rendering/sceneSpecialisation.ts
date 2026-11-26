/** The bits of a scene template's first packed constant (`scene_forward_clustered_inc.glsl:81-123`). */
export const PackedSpecialisationBit = {
  /** `use_directional_soft_shadows` (`:89-91`). */
  USE_DIRECTIONAL_SOFT_SHADOWS: 1 << 3,
  /** `use_depth_fog` (`:101-103`). */
  USE_DEPTH_FOG: 1 << 6,
} as const;
