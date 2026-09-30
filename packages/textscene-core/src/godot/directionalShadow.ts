/**
 * A DirectionalLight3D's orthogonal shadow, as the renderer sets it up: the camera slice it covers
 * and the defaults that shape it. `RendererSceneCull::_light_instance_setup_directional_shadow`
 * reads the viewing camera and never the light's position.
 */

/** `DirectionalLight3D()` sets `PARAM_SHADOW_MAX_DISTANCE` to 100 (`scene/3d/light_3d.cpp:600`). */
export const DIRECTIONAL_SHADOW_MAX_DISTANCE_DEFAULT = 100;

/** `Light3D()` sets `PARAM_SHADOW_PANCAKE_SIZE` to 20 (`scene/3d/light_3d.cpp:487`). */
export const DIRECTIONAL_SHADOW_PANCAKE_SIZE_DEFAULT = 20;

/**
 * `DirectionalLight3D()` sets `PARAM_SHADOW_NORMAL_BIAS` to 2 (`scene/3d/light_3d.cpp:603`), in texels
 * of the shadow map.
 */
export const DIRECTIONAL_SHADOW_NORMAL_BIAS_DEFAULT = 2;

/**
 * `rendering/lights_and_shadows/directional_shadow/size` defaults to 4096
 * (`servers/rendering/rendering_server.cpp:3704`). One orthogonal light takes the whole atlas.
 */
export const DIRECTIONAL_SHADOW_SIZE_DEFAULT = 4096;

/** The camera depths, from the eye, that one orthogonal shadow map covers. */
export interface DirectionalShadowSlice {
  near: number;
  far: number;
}

/**
 * `renderer_scene_cull.cpp:2143-2149`: the camera's own `[z_near, z_far]`, the far end pulled in
 * to a positive `shadow_max` for a perspective camera only, and kept 0.001 past the near end.
 * An orthogonal camera ignores `shadow_max`: the engine calls it impractical there.
 */
export function directionalShadowSlice(
  zNear: number,
  zFar: number,
  shadowMaxDistance: number,
  isOrthogonal: boolean
): DirectionalShadowSlice {
  let far = zFar;
  if (shadowMaxDistance > 0 && !isOrthogonal) far = shadowMaxDistance < far ? shadowMaxDistance : far;
  const nearFloor = zNear + 0.001;
  far = far > nearFloor ? far : nearFloor;
  const near = zNear < far ? zNear : far;
  return { near, far };
}

/**
 * `renderer_scene_cull.cpp:2282`: the fitted sphere grows by one texel on each side, so the
 * snapped box never clips the slice's outermost point.
 */
export function texelPaddedRadius(radius: number, shadowMapSize: number): number {
  return radius * (shadowMapSize / (shadowMapSize - 2));
}

/**
 * `renderer_scene_cull.cpp:2303`: the step the box edges snap to. A camera that moves less than
 * one step leaves the edges in place, so the shadow's jagged edges hold still.
 */
export function directionalShadowSnapStep(radius: number, shadowMapSize: number): number {
  return (radius * 4) / shadowMapSize;
}

/**
 * `renderer_scene_cull.cpp:2347`: one shadow-map texel in world units. The normal bias is counted
 * in these (`light_storage.cpp:724`), so it grows with the map's footprint.
 */
export function directionalShadowTexelSize(radius: number, shadowMapSize: number): number {
  return (radius * 2) / shadowMapSize;
}

/**
 * `render_forward_clustered.cpp:2606` switches pancaking on for any positive pancake size. The
 * depth pass then flattens a vertex past the near plane onto it
 * (`scene_forward_clustered.glsl:679-682`), so a caster nearer the light still casts.
 */
export function pancakesCasters(pancakeSize: number): boolean {
  return pancakeSize > 0;
}
