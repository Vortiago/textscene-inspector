/**
 * The texel count of one 2D light's shadow map, which Godot takes from one project setting and
 * every light of the canvas shares.
 */

/** `rendering/2d/shadow_atlas/size` (`servers/rendering/rendering_server.cpp:3714`). */
const DEFAULT_CANVAS_SHADOW_ATLAS_SIZE = 2048;

/**
 * Texels in one light's map for a project's `rendering/2d/shadow_atlas/size`, or the default for a
 * missing or non-positive value. Godot takes the value raw (`renderer_canvas_render_rd.cpp:2060`):
 * its range hint, 128 to 16384, bounds only the editor's slider, and only the runtime call
 * `set_shadow_texture_size` rounds to a power of two (`:2148-2150`). The polar map builder
 * gives each frustum `floor(size / 4)` columns, as Godot does.
 */
export function canvasShadowAtlasSize(setting: number | undefined): number {
  return setting !== undefined && setting > 0 ? setting : DEFAULT_CANVAS_SHADOW_ATLAS_SIZE;
}
