/**
 * Godot 4.6.3's soft shadow of a directional light with a `light_angular_distance`: the angle its
 * blocker search widens by, the box it widens, and the size it lights with
 * (`servers/rendering/renderer_rd/storage_rd/light_storage.cpp:668-703`,
 * `servers/rendering/renderer_scene_cull.cpp:2286-2299`).
 */

/** `Light3D()` sets `PARAM_SIZE`, which `light_angular_distance` sets, to 0 (`scene/3d/light_3d.cpp:478`). */
export const LIGHT_ANGULAR_DISTANCE_DEFAULT = 0;

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * `softshadow_angle`: the tangent of the angular distance, or zero for none
 * (`light_storage.cpp:676-689`, `:698`).
 */
export function softShadowAngle(angularDistance: number): number {
  return angularDistance > 0 ? Math.tan(radians(angularDistance)) : 0;
}

/** What turns on Godot's directional soft shadows for every directional light (`light_storage.cpp:680-686`). */
interface DirectionalSoftShadowInput {
  angularDistance: number;
  shadowEnabled: boolean;
  shadowBlur: number;
}

/**
 * Whether this light turns on `sc_use_directional_soft_shadows`, which then holds for every
 * directional light of the render (`scene_forward_clustered.glsl:2310`, `:2617`).
 */
export function drawsDirectionalSoftShadow({
  angularDistance,
  shadowEnabled,
  shadowBlur,
}: DirectionalSoftShadowInput): boolean {
  return angularDistance > 0 && shadowEnabled && shadowBlur > 0;
}

/** The light's `size`: the cosine offset its angular distance adds to N.L (`light_storage.cpp:670`). */
export function directionalLightSize(angularDistance: number): number {
  return 1 - Math.cos(radians(angularDistance));
}

/**
 * How far each side of a split's box widens, so that a caster the blocker search reaches is in the
 * box (`renderer_scene_cull.cpp:2290-2291`). `zRange` is the box's depth from the light's side to the
 * far side of the split's sphere.
 */
export function softShadowExpand(angle: number, zRange: number): number {
  return angle * zRange;
}
