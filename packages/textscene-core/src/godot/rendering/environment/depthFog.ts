/**
 * Godot 4.6.3's depth fog, the Environment's `fog_*` group: how the renderer hands a scene's values
 * to the shaders. `scene_forward_clustered.glsl` is
 * `renderer_rd/shaders/forward_clustered/`, and `sky.glsl` is `renderer_rd/shaders/environment/`.
 */

import { MAX_ROUGHNESS_LOD } from './skyReflection.js';

export const FogMode = {
  EXPONENTIAL: 0,
  DEPTH: 1,
} as const;

/**
 * The range a render fogs over: an end of 0 or below reaches the camera's far plane, and the begin
 * stays a millimetre short of the end, so the shader's smoothstep never divides by zero
 * (`storage_rd/render_scene_data_rd.cpp:215-216`).
 */
export function renderedDepthFogRange(
  range: { begin: number; end: number },
  cameraFar: number
): { begin: number; end: number } {
  const end = range.end > 0 ? range.end : cameraFar;
  return { begin: Math.min(range.begin, end - 0.001), end };
}

/** A height density below this leaves the height fog off (`scene_forward_clustered.glsl:1148`). */
export const HEIGHT_FOG_DENSITY_MIN = 0.0001;

/** A sun scatter at or below this adds no sun (`scene_forward_clustered.glsl:1126`, `sky.glsl:164`). */
export const FOG_SUN_SCATTER_MIN = 0.001;

/** The exponent that narrows the sun's glow in the fog (`scene_forward_clustered.glsl:1132`). */
export const FOG_SUN_SCATTER_EXPONENT = 8;

/**
 * The radiance mips the aerial perspective spans, as roughness: from the second mip at the far plane
 * to the blurriest at the near plane (`scene_forward_clustered.glsl:1109`).
 */
export const AERIAL_PERSPECTIVE_ROUGHNESS_MIN = 1 / MAX_ROUGHNESS_LOD;
