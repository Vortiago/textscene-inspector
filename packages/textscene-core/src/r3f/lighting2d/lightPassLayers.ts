/**
 * The camera layers the 2D light pass partitions its draws across, and the cap
 * on how many light classes one canvas may accumulate. Everything the pass
 * renders — the seed, each class's cookie quads, each class's `shadow_color`
 * quads — is addressed by one of these, so they are declared together: the
 * blocks must not overlap, and only the arithmetic here says they do not.
 */

/**
 * How many distinct light classes one canvas may accumulate.
 * The item-side injection unrolls one sampler per class, and GLSL ES 1.00
 * (which is what three compiles an `onBeforeCompile` injection as) cannot index
 * a sampler array by a runtime value, so the count has to be a compile-time
 * constant.
 *
 * There is a SECOND ceiling, and it is the tighter one: every lit 2D item now
 * binds two samplers per class (the accumulation and the `shadow_color` term)
 * on top of its own texture. WebGL2 guarantees 16 fragment texture units, so
 * the practical cap is around seven classes, not the fourteen the indexing rule
 * alone would allow. Raising this constant costs two units per lit item, and
 * overshooting shows up as a link-time sampler-limit failure rather than as a
 * dropped light.
 */
export const MAX_LIGHT_CLASSES = 4;

/**
 * The first camera layer light quads live on; class `i` uses `LIGHT_LAYER + i`.
 * Nothing else may use these: a class pre-pass renders exactly its own layer
 * (plus the seed), and the main pass renders neither.
 */
export const LIGHT_LAYER = 1;

/**
 * The seed quad's own layer. Every class pass enables it, so the seed is written
 * once per pass without belonging to any class.
 */
export const LIGHT_SEED_LAYER = LIGHT_LAYER + MAX_LIGHT_CLASSES;

/**
 * Where class `i`'s `shadow_color` quads draw: `SHADOW_TINT_LAYER + i`.
 *
 * They need a pass of their own because their term is the one thing in the light
 * pipeline that is NOT multiplied by the item's albedo. `light_shadow_compute`
 * runs AFTER `light_color.rgb *= base_color.rgb`, and its `mix` overwrites rgb
 * outright, so `shadow_color` reaches the canvas neat. The ordinary accumulator
 * cannot carry it: every item multiplies that buffer by its own albedo.
 *
 * Measured on Godot 4.6.3 — one shadow over surfaces of 0.25 and 0.75 albedo, at
 * equal distance from the light, adds the SAME 15/255 to each. An albedo-scaled
 * term would have added 3x more to the second.
 */
export const SHADOW_TINT_LAYER = LIGHT_SEED_LAYER + 1;

/**
 * Where a light lands when its cull-mask class did not fit in
 * `MAX_LIGHT_CLASSES`, or before the provider has classified it. No pass ever
 * enables this layer, so such a quad is simply never drawn, which is the
 * dropping the provider's warning announces.
 */
export const LIGHT_UNCLASSED_LAYER = SHADOW_TINT_LAYER + MAX_LIGHT_CLASSES;

/** Draw order within a light layer: the seed must land under every light. */
export const SEED_RENDER_ORDER = -1;
