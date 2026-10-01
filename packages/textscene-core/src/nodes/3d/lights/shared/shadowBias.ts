/**
 * Godot `shadow_bias` → three `LightShadow.bias`, negated: Godot displaces the receiver
 * at lookup, three adds to the compared depth of `step(compare, stored)`
 * (`shadowmap_pars_fragment.glsl.js:122,232`, PCFSoft). The light types differ in unit, so
 * omni and spot match at the far plane their range authors, a stated divergence nearer.
 */

import { softShadowScale } from '../../../../godot/softShadowScale';

/** `scene/3d/light_3d.cpp:490` (Light3D) and `:681` (SpotLight3D). */
const GODOT_SHADOW_BIAS_DEFAULT = { DIRECTIONAL: 0.1, OMNI: 0.1, SPOT: 0.03 } as const;

/**
 * Exact: `light_storage.cpp:723` sends `shadow_bias / 100 * bias_scale`,
 * `renderer_scene_cull.cpp:2348` makes `bias_scale` the cascade's ortho depth range,
 * and `scene_forward_clustered.glsl:2304` spends it inside that range, so in
 * normalised depth the range cancels.
 */
export function directionalShadowBias(
  shadowBias: number | undefined,
  shadowBlur: number | undefined
): number {
  const bias = shadowBias ?? GODOT_SHADOW_BIAS_DEFAULT.DIRECTIONAL;
  return -(bias / 100) * softShadowScale(shadowBlur);
}

/**
 * Approximate: Godot subtracts the unscaled bias (`light_storage.cpp:973`) from a
 * radial distance stored linearly (`scene_forward_lights_inc.glsl:594`), and three's
 * cube depth is projective (`shadowmap_pars_fragment.glsl.js:292`). `near / (far * (far - near))`
 * is `d(dp)/dz` at `z = far`, so nearer the light this undershoots.
 */
export function omniShadowBias(shadowBias: number | undefined, near: number, far: number): number {
  if (!(far > near)) return 0;
  // No `soft_shadow_scale`: `light_storage.cpp:1024` sits in the spot branch alone.
  const bias = shadowBias ?? GODOT_SHADOW_BIAS_DEFAULT.OMNI;
  // Proportional to `1 / near`, and `near` is ours: Godot's lookup has none
  // (`scene_forward_lights_inc.glsl:594-596`) and its camera uses `MIN(0.025, range)`
  // (`renderer_scene_cull.cpp:2443`). three's cube shadow needs a positive near.
  return (-bias * near) / (far * (far - near));
}

/**
 * Approximate: Godot sends `shadow_bias / 100` (`light_storage.cpp:971`) before the
 * perspective divide (`scene_forward_lights_inc.glsl:786`), buying `shadow_bias / w`,
 * and three adds a constant after it (`:121-122`, `:227-232`). Dividing by far
 * matches at far and undershoots nearer.
 */
export function spotShadowBias(
  shadowBias: number | undefined,
  shadowBlur: number | undefined,
  far: number
): number {
  if (!(far > 0)) return 0;
  // `light_storage.cpp:1024` scales the spot bias, and only it, by `soft_shadow_scale`.
  const bias = shadowBias ?? GODOT_SHADOW_BIAS_DEFAULT.SPOT;
  return (-(bias / 100) * softShadowScale(shadowBlur)) / far;
}
