/** Render-side constants that match three.js light output to Godot. No parse or lint code imports them. */

/**
 * Godot `light_energy` → three `intensity`. Godot multiplies energy by PI in the light buffer
 * (`light_storage.cpp`, non-physical units, every light type), and `diffuse_brdf_NL` divides it
 * out. three keeps 1/PI in `BRDF_Lambert`, so `intensity = energy * PI`. A Godot 4.6.3 render
 * asks for 2 × 1.5748, against PI = 2 × 1.5708.
 */
export const LIGHT_INTENSITY_SCALE = Math.PI;

/** Godot's shadow bias is positive, and three's is negative. */
export const SHADOW_BIAS_SCALE = 0.01;

/**
 * How far behind a directional light its shadow camera starts, and the frustum half-extent.
 * Godot's directional shadow ignores the node's position, so a light at the origin must still
 * reach its casters. A negative near plane does it, as moving the light would move its helper,
 * selection box and F-to-frame. Shared with the preview sun, so the two cannot drift.
 */
export const DIRECTIONAL_SHADOW_NEAR = -30;
export const DIRECTIONAL_SHADOW_FRUSTUM_HALF = 20;

/** Soft-shadow radius: a higher value is softer and costs more. */
export const SHADOW_RADIUS_DEFAULT = 4;

/**
 * Shadow-map resolution for every casting light. three's default 512 looks blocky next to Godot.
 * 2048 gives ~0.02-unit texels over the directional light's 40-unit frustum and stays cheap for
 * one headless frame.
 */
export const SHADOW_MAP_SIZE = 2048;

/**
 * A constant depth bias detaches the shadow from the caster's base ("peter-panning"). The 2048
 * map needs far less bias against acne than a 512 map, so these are about a fifth of the 512
 * values, and SHADOW_NORMAL_BIAS suppresses the acne.
 */
export const DEFAULT_SHADOW_BIAS = {
  /** SpotLight default. */
  SPOT: -0.0004,
  /** DirectionalLight default (lower bias for parallel rays). */
  DIRECTIONAL: -0.0001,
  /** OmniLight default (middle ground for omnidirectional). */
  OMNI: -0.0002,
} as const;

/**
 * Receiver offset along the normal, in world units, before the shadow lookup. Unlike a depth bias
 * it suppresses acne on lit slopes without detaching the shadow, as Godot's shadows touch their
 * casters. Shared by every casting light and the preview sun.
 */
export const SHADOW_NORMAL_BIAS = 0.04;
