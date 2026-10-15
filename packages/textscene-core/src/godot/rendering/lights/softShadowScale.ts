/**
 * Godot's `soft_shadow_scale` for a directional light: the radius of its PCF kernel in atlas texels,
 * or the spread of its blocker search, and the factor its depth bias carries
 * (`servers/rendering/renderer_rd/storage_rd/light_storage.cpp:697-703`, `:723`). An omni, spot or
 * area light's takes its size into account (`positionalSoftShadow`).
 */

/**
 * The PCF quality radius at the default soft shadow filter quality, Soft Low
 * (`servers/rendering/rendering_server.cpp:3706`, `:3710`): 2 for a directional light
 * (`renderer_scene_render_rd.cpp:1204-1207`) and for a positional one (`:1157-1160`). A `.tscn`
 * does not record the project setting.
 */
export const SOFT_LOW_QUALITY_RADIUS = 2;

/**
 * `light_storage.cpp:697-703`: `shadow_blur` times the quality radius. A light with an angular
 * distance takes `shadow_blur` alone, as its blocker search spreads it.
 */
export function softShadowScale(shadowBlur: number, angularDistance: number): number {
  return angularDistance > 0 ? shadowBlur : shadowBlur * SOFT_LOW_QUALITY_RADIUS;
}
