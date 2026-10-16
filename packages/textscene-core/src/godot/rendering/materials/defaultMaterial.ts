/** The hardcoded shader Godot draws a surface with when no material is set. */

/**
 * `ALBEDO = vec3(0.6)` in the default shader's `fragment()` (`scene_shader_forward_clustered.cpp:920`),
 * a shader constant and so linear.
 */
export const DEFAULT_MATERIAL_ALBEDO = 0.6;

/** `ROUGHNESS = 0.8`, in both `vertex()` and `fragment()` (`scene_shader_forward_clustered.cpp:916,921`). */
export const DEFAULT_MATERIAL_ROUGHNESS = 0.8;

/** `METALLIC = 0.2` in `fragment()` (`scene_shader_forward_clustered.cpp:922`). */
export const DEFAULT_MATERIAL_METALLIC = 0.2;

/**
 * `ALPHA_HASH_SCALE`'s value in a shader that never writes it (`scene_forward_clustered.glsl:1303`).
 * A BaseMaterial3D's own default is `alphaHashScale` in `scene/baseMaterial3D.ts`.
 */
export const SHADER_ALPHA_HASH_SCALE_DEFAULT = 1;
