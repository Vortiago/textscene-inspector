/** The bits of `SceneData.flags` a scene template reads (`scene_data_inc.glsl:6-13`). */
export const SceneDataFlag = {
  USE_AMBIENT_LIGHT: 1 << 0,
  USE_AMBIENT_CUBEMAP: 1 << 1,
  USE_REFLECTION_CUBEMAP: 1 << 2,
  USE_ROUGHNESS_LIMITER: 1 << 3,
  USE_FOG: 1 << 4,
  USE_UV2_MATERIAL: 1 << 5,
  USE_PANCAKE_SHADOWS: 1 << 6,
  IN_SHADOW_PASS: 1 << 7,
} as const;
