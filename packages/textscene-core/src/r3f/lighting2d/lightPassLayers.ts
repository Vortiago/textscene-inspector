/**
 * The camera layers the 2D light pass draws on, and the cap on light classes per canvas. Declared
 * together because the blocks must not overlap, and only this arithmetic says they do not.
 */

/**
 * A compile-time constant: GLSL ES 1.00, which three compiles `onBeforeCompile` as, cannot index a
 * sampler array at runtime. A lit item binds two samplers per class beside its texture, and WebGL2
 * guarantees 16 fragment units, so the cap is about seven. Overshoot fails at link time.
 */
export const MAX_LIGHT_CLASSES = 4;

/**
 * Class `i`'s light quads draw on `LIGHT_LAYER + i`, and nothing else may. A class pre-pass renders
 * its own layer and the seed, and the main pass renders neither.
 */
export const LIGHT_LAYER = 1;

/**
 * The seed quad's own layer. Every class pass enables it, so the seed is written
 * once per pass without belonging to any class.
 */
export const LIGHT_SEED_LAYER = LIGHT_LAYER + MAX_LIGHT_CLASSES;

/**
 * Class `i`'s `shadow_color` quads draw on `SHADOW_TINT_LAYER + i`, in their own pass:
 * `light_shadow_compute` runs after `light_color.rgb *= base_color.rgb` and its `mix` overwrites
 * rgb, so the tint is not albedo-scaled. Godot 4.6.3 adds the same 15/255 over 0.25 and 0.75 albedo.
 */
export const SHADOW_TINT_LAYER = LIGHT_SEED_LAYER + 1;

/**
 * Where a light lands when its class did not fit in `MAX_LIGHT_CLASSES`, or before the provider
 * classifies it. No pass enables this layer, so the quad is never drawn, as the provider warns.
 */
export const LIGHT_UNCLASSED_LAYER = SHADOW_TINT_LAYER + MAX_LIGHT_CLASSES;

/** Draw order within a light layer: the seed must land under every light. */
export const SEED_RENDER_ORDER = -1;
