/**
 * The texel count of one 2D light's shadow map, which Godot takes from one project setting and
 * every light of the canvas shares.
 */

/** `rendering/2d/shadow_atlas/size` (`servers/rendering/rendering_server.cpp:3714`). */
const DEFAULT_CANVAS_SHADOW_ATLAS_SIZE = 2048;

/**
 * Texels in one light's map. Godot takes the project value raw (`renderer_canvas_render_rd.cpp:2060`);
 * only the runtime `set_shadow_texture_size` rounds to a power of two (`:2148-2150`). The default
 * stands for a missing or non-positive value.
 */
export function canvasShadowAtlasSize(setting: number | undefined): number {
  return setting !== undefined && setting > 0 ? setting : DEFAULT_CANVAS_SHADOW_ATLAS_SIZE;
}
