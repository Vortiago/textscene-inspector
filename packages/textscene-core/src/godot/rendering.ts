/** RenderingServer-wide limits, as the engine declares them. */

/**
 * `RenderingServer::MATERIAL_RENDER_PRIORITY_MIN` / `_MAX`
 * (`servers/rendering/rendering_server.h:257-258`), the closed range every
 * material render-order property is held to.
 *
 * A RenderingServer fact, not any node's: it grounds `SpriteBase3D.render_priority`
 * (`sprite_3d.cpp:383`) and both `Label3D.render_priority` (`label_3d.cpp:766`)
 * and `Label3D.outline_render_priority` (`label_3d.cpp:778`). Those two classes
 * share no ancestor that owns the property, so there is no slice to hoist onto
 * and re-spelling the pair per slice is how the numbers drift apart.
 *
 * ENFORCED, not merely hinted: each setter opens with
 * `ERR_FAIL_COND(p_priority < MIN || p_priority > MAX)`, so a value outside the
 * range is refused rather than clamped. Cite the SETTER's `file:line` at each
 * call site — this constant carries the numbers, not the grounding.
 */
export const MATERIAL_RENDER_PRIORITY_MIN = -128;
/** See {@link MATERIAL_RENDER_PRIORITY_MIN}. */
export const MATERIAL_RENDER_PRIORITY_MAX = 127;
