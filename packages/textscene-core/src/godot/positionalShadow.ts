/**
 * How Godot's forward renderer sets up an omni or spot light's shadow: which lights the cull hands
 * the atlas, the depth range of the map, and the two biases the lookup moves the receiver by.
 */

/** `Light3D()` sets `PARAM_SHADOW_NORMAL_BIAS` to 1 (`scene/3d/light_3d.cpp:491`). */
export const POSITIONAL_SHADOW_NORMAL_BIAS_DEFAULT = 1;

/** The near plane Godot renders an omni or spot shadow from (`renderer_scene_cull.cpp:2442`, `:2531`). */
const SHADOW_Z_NEAR = 0.025;

/**
 * The near plane of an omni or spot light's shadow camera: 0.025, or the range when it is shorter
 * (`servers/rendering/renderer_scene_cull.cpp:2442`, `:2531`).
 */
export function positionalShadowNear(range: number): number {
  return Math.min(SHADOW_Z_NEAR, range);
}

/**
 * The normal bias the shader reads: `shadow_normal_bias` times ten texels of the light's slot
 * (`light_storage.cpp:967-968`, the texel from `light_storage.h:699-717`). It has no unit: the omni
 * lookup adds it to a unit direction, the spot lookup scales it by the distance to the light.
 */
export function positionalShadowNormalBias(normalBias: number, slotSize: number): number {
  return (normalBias * 10) / slotSize;
}

/**
 * A spot light's depth bias: `shadow_bias / 100` (`light_storage.cpp:971`) times
 * `soft_shadow_scale`, which only the spot branch applies (`:1024`). The lookup adds it to the
 * reversed clip depth before the perspective divide (`scene_forward_lights_inc.glsl:786-787`).
 */
export function spotShadowDepthBias(shadowBias: number, softShadowScale: number): number {
  return (shadowBias / 100) * softShadowScale;
}

/** The box a light's volume fills in its own space, its corners at `min` and `max`. */
interface LightBounds {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

/**
 * The box the cull tests against the camera frustum to decide whether a light takes part in the
 * render (`light_storage.cpp:428-455`, `renderer_scene_cull.cpp:2853-2856`): a cube of the range
 * around an omni light, and a spot light's cone along its -Z, or the cube once the cone opens wider
 * than a hemisphere. `spotAngle` is in degrees and is null for an omni light.
 */
export function positionalLightBounds(range: number, spotAngle: number | null): LightBounds {
  const angle = spotAngle === null ? null : (spotAngle * Math.PI) / 180;
  if (angle === null || angle > Math.PI * 0.5) {
    return { min: [-range, -range, -range], max: [range, range, range] };
  }
  const size = Math.sin(angle) * range;
  return { min: [-size, -size, -range], max: [size, size, 0] };
}
