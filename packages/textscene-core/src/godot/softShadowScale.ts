/**
 * Godot's `soft_shadow_scale` for a light without a size: the radius of its PCF kernel in atlas
 * texels, and the factor its directional and spot depth bias carry
 * (`servers/rendering/renderer_rd/storage_rd/light_storage.cpp:697-703`, `:723`, `:986-999`,
 * `:1019-1024`). An omni light spreads that radius over a paraboloid (`godot/positionalShadowAtlas.ts`).
 */

/** `Light3D()` sets `PARAM_SHADOW_BLUR` to 1 (`scene/3d/light_3d.cpp:489`). */
export const SHADOW_BLUR_DEFAULT = 1;

/**
 * The PCF quality radius at the default soft shadow filter quality, Soft Low
 * (`servers/rendering/rendering_server.cpp:3706`, `:3710`): 2 for a directional light
 * (`renderer_scene_render_rd.cpp:1204-1207`) and for a positional one (`:1157-1160`). A `.tscn`
 * does not record the project setting.
 */
export const SOFT_LOW_QUALITY_RADIUS = 2;

/**
 * `light_storage.cpp:697-703` for a directional light and `:999`, `:1022` for an omni or spot light:
 * `shadow_blur` times the quality radius. A light with a size or an angular size takes `shadow_blur`
 * alone, for a soft-shadow path the previewer does not draw.
 */
export function softShadowScale(shadowBlur: number | undefined): number {
  return (shadowBlur ?? SHADOW_BLUR_DEFAULT) * SOFT_LOW_QUALITY_RADIUS;
}
