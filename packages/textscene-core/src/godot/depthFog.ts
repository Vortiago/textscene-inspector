/**
 * Godot 4.6.3's depth fog, the Environment's `fog_*` group: how its setters store a scene's values
 * and how the renderer hands them to the shaders. `scene_forward_clustered.glsl` is
 * `renderer_rd/shaders/forward_clustered/`, and `sky.glsl` is `renderer_rd/shaders/environment/`.
 */

export const FogMode = {
  EXPONENTIAL: 0,
  DEPTH: 1,
} as const;

/**
 * The density a scene stores no `fog_density` for. `set_fog_mode` runs before the density on load
 * and sets 1 for any mode but a change to exponential (`scene/resources/environment.cpp:778-784`),
 * so a depth fog's density starts at 1.
 */
export function depthFogDensityDefault(mode: number): number {
  return mode === FogMode.DEPTH ? 1 : 0.01;
}

/** `fog_depth_begin` and `fog_depth_end`'s defaults (`scene/resources/environment.h:196-197`). */
const DEPTH_BEGIN_DEFAULT = 10;
const DEPTH_END_DEFAULT = 100;

/**
 * The range the setters store. Each setter drags the other end along so the begin never passes the
 * end, and the begin loads first (`scene/resources/environment.cpp:879-896`).
 */
export function depthFogRange(authored: { begin?: number; end?: number }): { begin: number; end: number } {
  let begin = DEPTH_BEGIN_DEFAULT;
  let end = DEPTH_END_DEFAULT;
  if (authored.begin !== undefined) {
    begin = authored.begin;
    if (begin > end) end = begin;
  }
  if (authored.end !== undefined) {
    end = authored.end;
    if (end < begin) begin = end;
  }
  return { begin, end };
}

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

/** The blurriest radiance mip, for the default 8 `roughness_layers` (`MAX_ROUGHNESS_LOD`). */
export const MAX_ROUGHNESS_LOD = 7;

/**
 * The radiance mips the aerial perspective spans, as roughness: from the second mip at the far plane
 * to the blurriest at the near plane (`scene_forward_clustered.glsl:1109`).
 */
export const AERIAL_PERSPECTIVE_ROUGHNESS_MIN = 1 / MAX_ROUGHNESS_LOD;
