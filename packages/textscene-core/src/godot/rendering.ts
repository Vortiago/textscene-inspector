/**
 * RenderingServer-wide limits, as the engine declares them. They live here because classes with
 * no shared ancestor that owns the property read them, so a per-slice copy would diverge. Each
 * constant carries the numbers, not the grounding: cite the setter's `file:line` at each call site.
 */

/**
 * `RenderingServer::MATERIAL_RENDER_PRIORITY_MIN` / `_MAX` (`servers/rendering/rendering_server.h:258-259`),
 * enforced: each setter opens with `ERR_FAIL_COND(p_priority < MIN || p_priority > MAX)` and refuses, not clamps.
 * Grounds `SpriteBase3D.render_priority` (`sprite_3d.cpp:383`), `Label3D.render_priority` (`label_3d.cpp:766`),
 * `Label3D.outline_render_priority` (`label_3d.cpp:778`) and `Material.render_priority` (`material.cpp:65`, `material.h:74-75` aliases the RS pair).
 */
export const MATERIAL_RENDER_PRIORITY_MIN = -128;
/** See {@link MATERIAL_RENDER_PRIORITY_MIN}. */
export const MATERIAL_RENDER_PRIORITY_MAX = 127;

/**
 * `RenderingServer::CANVAS_ITEM_Z_MIN` / `_MAX` (`servers/rendering/rendering_server.h:103-104`), a 2D draw order's depth
 * window. Godot concatenates them into the hint (`itos(RS::CANVAS_ITEM_Z_MIN) + "," + itos(RS::CANVAS_ITEM_Z_MAX)`), so
 * the numbers appear in unrelated `.cpp` files. Both hint ends are closed, with no `,or_greater` or `,or_less`: a value
 * outside warns where the setter assigns, and errors only where a setter clamps.
 */
export const CANVAS_ITEM_Z_MIN = -4096;
/** See {@link CANVAS_ITEM_Z_MIN}. */
export const CANVAS_ITEM_Z_MAX = 4096;

/**
 * `RenderingServer::CANVAS_LAYER_MIN` / `_MAX` (`servers/rendering/rendering_server.h:105-106`), int32's own limits,
 * declared beside the Z pair and spelled into their hints the same way (`light_2d.cpp:311-312`, `canvas_layer.cpp:340`).
 */
export const CANVAS_LAYER_MIN = -2147483648;
/** See {@link CANVAS_LAYER_MIN}. */
export const CANVAS_LAYER_MAX = 2147483647;
