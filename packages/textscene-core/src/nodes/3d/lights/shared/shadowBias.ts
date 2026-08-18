/**
 * Godot `shadow_bias` → three `LightShadow.bias`.
 *
 * Godot spends the bias at LOOKUP time, displacing the receiver before it
 * samples the shadow map; three adds its bias to the compared depth
 * (`shadowmap_pars_fragment.glsl.js:122,232` — this canvas runs PCFSoft). Both are "make the receiver read as
 * nearer the light", so every mapping here is negated — three's comparison is
 * `step(compare, stored)`, so a smaller compare is more lit.
 *
 * The three light types do NOT share a unit, and that is the whole reason a
 * single scale factor cannot exist:
 *
 * - Directional: `light_storage.cpp:723` sends `shadow_bias / 100 * bias_scale`,
 *   `renderer_scene_cull.cpp:2348` sets `bias_scale` to the cascade's ortho
 *   depth range, and `scene_forward_clustered.glsl:2304` spends it as a world
 *   offset along the light ray inside that same range. An ortho depth buffer is
 *   affine in that distance, so the range cancels: in normalized depth Godot's
 *   offset is exactly `shadow_bias / 100 * soft_shadow_scale`, whatever the
 *   cascade's size. That is three's unit exactly — EXACT mapping.
 * - Omni: `light_storage.cpp:973` sends `shadow_bias` UNSCALED, and
 *   `scene_forward_lights_inc.glsl:594` subtracts it from a world-space radial
 *   distance whose stored depth is LINEAR over `[0, omni_range]`. three stores a
 *   projective cube depth (`shadowmap_pars_fragment.glsl.js:292`), so the same
 *   world offset is worth a different amount of depth at every distance.
 * - Spot: `light_storage.cpp:971` sends `shadow_bias / 100` and
 *   `scene_forward_lights_inc.glsl:786` adds it BEFORE the perspective divide,
 *   so the depth it actually buys is that over `w` — the axial distance to the
 *   light. three adds after the divide (`:121-122`, `:227-232`), i.e. a constant.
 *
 * So omni and spot have no distance-independent equivalent. Both are evaluated
 * at the shadow camera's far plane — the one distance the light itself authors
 * (`omni_range` / `spot_range`, already the camera's far). Godot applies MORE
 * bias at every closer distance; that residual is a stated divergence, not a
 * fitted number.
 */

/** `scene/3d/light_3d.cpp:490` (Light3D) and `:681` (SpotLight3D). */
const GODOT_SHADOW_BIAS_DEFAULT = { DIRECTIONAL: 0.1, OMNI: 0.1, SPOT: 0.03 } as const;

/** `Light3D::PARAM_SHADOW_BLUR` default (`scene/3d/light_3d.cpp:489`). */
const GODOT_SHADOW_BLUR_DEFAULT = 1;

/**
 * `soft_shadow_scale`'s PCF factor. The project setting defaults to index 2,
 * "Soft Low" (`rendering_server.cpp:3706`), which is radius 2
 * (`renderer_scene_render_rd.cpp:1204-1207`). It only applies while the light's
 * angular diameter is 0 (`light_storage.cpp:701-703`), which is the default and
 * the only case a `.tscn` without `light_angular_distance` can be in.
 *
 * A `.tscn` carries no record of the setting, so this is an input we cannot
 * observe: a project that changed it makes every directional and spot bias here
 * wrong by that ratio, up to 2x either way.
 */
const GODOT_PCF_QUALITY_RADIUS = 2;

/** Godot's `soft_shadow_scale` for a light that has not been given a size. */
function softShadowScale(shadowBlur: number | undefined): number {
  return (shadowBlur ?? GODOT_SHADOW_BLUR_DEFAULT) * GODOT_PCF_QUALITY_RADIUS;
}

/**
 * Exact: the cascade depth range Godot multiplies in is the same range the
 * ortho depth buffer divides out again.
 */
export function directionalShadowBias(
  shadowBias: number | undefined,
  shadowBlur: number | undefined
): number {
  const bias = shadowBias ?? GODOT_SHADOW_BIAS_DEFAULT.DIRECTIONAL;
  return -(bias / 100) * softShadowScale(shadowBlur);
}

/**
 * Approximate: `near / (far * (far - near))` is `d(dp)/dz` at `z = far`, so the
 * world-space offset is reproduced there and undershot nearer the light. Godot
 * never scales the omni bias by `soft_shadow_scale` — `light_storage.cpp:1024`
 * sits inside the spot branch alone.
 *
 * The result is inversely proportional to `near`, and `near` is ours alone:
 * Godot's omni lookup normalizes a radial distance over `[0, range]` with no
 * near plane at all (`scene_forward_lights_inc.glsl:594-596`), and even the
 * shadow camera it renders with uses `MIN(0.025, range)`
 * (`renderer_scene_cull.cpp:2443`). three's cube shadow needs a positive near,
 * so whatever the caller passes sets the scale of this whole mapping.
 */
export function omniShadowBias(
  shadowBias: number | undefined,
  near: number,
  far: number
): number {
  if (!(far > near)) return 0;
  const bias = shadowBias ?? GODOT_SHADOW_BIAS_DEFAULT.OMNI;
  return (-bias * near) / (far * (far - near));
}

/**
 * Approximate: Godot's offset is `shadow_bias / w` for `w` the axial distance to
 * the light, so dividing by the far plane matches it there and undershoots it
 * everywhere nearer. `light_storage.cpp:1024` scales the spot bias — and only
 * the spot bias — by `soft_shadow_scale`.
 */
export function spotShadowBias(
  shadowBias: number | undefined,
  shadowBlur: number | undefined,
  far: number
): number {
  if (!(far > 0)) return 0;
  const bias = shadowBias ?? GODOT_SHADOW_BIAS_DEFAULT.SPOT;
  return (-(bias / 100) * softShadowScale(shadowBlur)) / far;
}
