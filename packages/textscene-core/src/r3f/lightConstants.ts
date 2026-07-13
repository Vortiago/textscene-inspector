/**
 * Shared constants for lighting calculations — render-side only.
 *
 * These constants tune three.js light output to match Godot's visual
 * appearance and live next to their render-side consumers in `r3f/`.
 * No parse- or lint-side code should import from here.
 */

/**
 * Intensity scaling factor when converting from Godot to three.js.
 * Godot lights appear dimmer in three.js without scaling.
 */
export const LIGHT_INTENSITY_SCALE = 2;

/**
 * Shadow bias scaling factor when converting from Godot to three.js.
 * Godot uses positive bias values, three.js uses negative bias.
 */
export const SHADOW_BIAS_SCALE = 0.01;

/**
 * Default shadow radius for soft shadows in three.js.
 * Higher values create softer shadows but may impact performance.
 */
export const SHADOW_RADIUS_DEFAULT = 4;

/**
 * Default shadow bias values per light type.
 * These prevent shadow acne while minimizing peter-panning.
 */
export const DEFAULT_SHADOW_BIAS = {
  /** SpotLight default: -0.002 */
  SPOT: -0.002,
  /** DirectionalLight default: -0.0005 (lower bias for parallel rays) */
  DIRECTIONAL: -0.0005,
  /** OmniLight default: -0.001 (middle ground for omnidirectional) */
  OMNI: -0.001,
} as const;
