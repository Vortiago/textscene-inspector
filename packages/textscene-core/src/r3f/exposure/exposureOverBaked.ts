/**
 * The rule a lightmap and a reflection probe share: Godot stores each at the exposure it was baked
 * or captured at, and draws it at the exposure of the render over that one.
 */

/**
 * The factor a baked lightmap or captured probe is read at: the exposure over the baked one, or 1
 * with no camera attributes (`render_forward_clustered.cpp:1222-1229`, `light_storage.cpp:1810-1814`).
 * Godot divides by the baked exposure as it is, so a baked exposure of 0 gives infinity there too.
 *
 * @oneWay The scale of a baked lightmap or a captured probe under the exposure
 */
export function exposureOverBaked(exposure: number | null, bakedExposure: number): number {
  return exposure === null ? 1 : exposure / bakedExposure;
}
