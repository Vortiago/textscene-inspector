/**
 * Shared constants for lighting calculations — render-side only.
 *
 * These constants tune three.js light output to match Godot's visual
 * appearance and live next to their render-side consumers in `r3f/`.
 * No parse- or lint-side code should import from here.
 */

/**
 * Godot `light_energy` → three `intensity`.
 *
 * Not a taste knob: the two engines put the Lambert 1/PI in different places.
 * Godot multiplies energy by PI when it fills the light buffer
 * (`light_storage.cpp`, the `else` branch of the physical-light-units test —
 * and it does this for directional, omni and spot alike), then its shader's
 * `diffuse_brdf_NL = cNdotL * (1.0 / M_PI)` divides it back out, leaving
 *
 *     Godot diffuse = albedo * N.L * colour * energy
 *
 * three keeps the 1/PI in the BRDF (`BRDF_Lambert = RECIPROCAL_PI * diffuse`)
 * and applies intensity to the light colour unscaled, leaving
 *
 *     three diffuse = albedo / PI * N.L * colour * intensity
 *
 * so `intensity = energy * PI`. The physical statement is that a Lambertian
 * surface facing a white energy-1.0 light renders exactly its own albedo,
 * which `scenes/fixtures/unit-light-transport-direct.tscn` shows directly: an
 * unshaded patch of that albedo sits on the lit plane and disappears into it.
 *
 * Measured against a Godot 4.6.3 render of that fixture, the previous value of
 * 2 left the lit plane at 106/255 where Godot puts it at 131; the ratio the
 * pixels ask for is 1.5748 against PI/2 = 1.5708.
 */
export const LIGHT_INTENSITY_SCALE = Math.PI;

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
