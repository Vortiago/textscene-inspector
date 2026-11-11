/**
 * The texel count of one 2D light's shadow map, which Godot takes from one project setting and
 * every light of the canvas shares.
 */

/** `rendering/2d/shadow_atlas/size` (`servers/rendering/rendering_server.cpp:3714`). */
const DEFAULT_CANVAS_SHADOW_ATLAS_SIZE = 2048;

/**
 * Texels in one light's map for a project's `rendering/2d/shadow_atlas/size`, or the default for a
 * missing or non-positive value. Godot's range hint, 128 to 16384, bounds only the editor's slider.
 * The map builders split the row into four equal frusta, so a size four does not divide is outside
 * what they model.
 */
export function canvasShadowAtlasSize(setting: number | undefined): number {
  return setting !== undefined && setting > 0 ? setting : DEFAULT_CANVAS_SHADOW_ATLAS_SIZE;
}
