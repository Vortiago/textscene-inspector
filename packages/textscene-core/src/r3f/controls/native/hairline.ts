/**
 * The quad that stands in for a `draw_line` without a width. That call draws a two-point line, not
 * a quad (`renderer_canvas_cull.cpp:754-763`). Vulkan lights the pixel within half a pixel of the
 * line, and on a tie the one before it.
 */

/** @canonical The thickness of a `draw_line` without a width: one hairline pixel */
export const HAIRLINE_THICKNESS_PX = 1;

/**
 * A quad centred on the line covers the pixel Godot lights, under the top-left tie rule (ADR-0057).
 * @canonical Where the quad of a hairline `draw_line` at `atPx` starts on its cross axis
 */
export function hairlineQuadStartPx(atPx: number): number {
  return atPx - HAIRLINE_THICKNESS_PX / 2;
}
