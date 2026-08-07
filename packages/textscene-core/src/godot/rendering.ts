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

/**
 * `RenderingServer::CANVAS_ITEM_Z_MIN` / `_MAX`
 * (`servers/rendering/rendering_server.h:103-104`), the depth window a 2D draw
 * order is expressed in.
 *
 * Godot spells these into the inspector hint by string concatenation
 * (`itos(RS::CANVAS_ITEM_Z_MIN) + "," + itos(RS::CANVAS_ITEM_Z_MAX)`), which is
 * why the numbers appear in several unrelated `.cpp` files and why a slice that
 * re-types them is the drift risk. Both ends are CLOSED in the hint — neither
 * `,or_greater` nor `,or_less` — so a value outside them is a warning wherever
 * the setter merely assigns, and an error only where a setter clamps.
 * Cite the SETTER's `file:line` at each call site; these constants carry the
 * numbers, not the grounding.
 */
export const CANVAS_ITEM_Z_MIN = -4096;
/** See {@link CANVAS_ITEM_Z_MIN}. */
export const CANVAS_ITEM_Z_MAX = 4096;

/**
 * `RenderingServer::CANVAS_LAYER_MIN` / `_MAX`
 * (`servers/rendering/rendering_server.h:105-106`).
 *
 * These are int32's own limits, not a narrower engine rule: the hint they build
 * spans every value the field can hold, so it excludes nothing an int property
 * could legally carry. A validator that "enforces" them therefore adds no check
 * beyond the integer format itself — they are here so a reader can see that the
 * hint is vacuous rather than assume a bound was overlooked.
 */
export const CANVAS_LAYER_MIN = -2147483648;
/** See {@link CANVAS_LAYER_MIN}. */
export const CANVAS_LAYER_MAX = 2147483647;
