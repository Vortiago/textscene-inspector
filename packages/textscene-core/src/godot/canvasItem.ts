/** CanvasItem's own enums, as the engine declares them. */

/**
 * `CanvasItem::ClipChildrenMode` (`scene/main/canvas_item.h:71-75`), the
 * serialised values of `clip_children`.
 *
 * `CLIP_CHILDREN_MAX = 3` is a count sentinel, not a mode, which is why the
 * legal span is 0..2 and the labels below stop there.
 *
 * Two places read this enum and they read it differently: the CanvasItem tier
 * validates the whole range, while CanvasGroup's rule only asks whether an
 * ancestor clips at all — Godot tests `get_clip_children_mode() !=
 * CLIP_CHILDREN_DISABLED` in its own configuration warnings
 * (`canvas_group.cpp:76`, and again at `canvas_item.cpp:1308`). The DISABLED
 * sentinel is exported so that second reading stays a named engine fact rather
 * than a bare `!== 0`.
 */
export const CLIP_CHILDREN_DISABLED = 0;

/**
 * The mode names Godot binds (`BIND_ENUM_CONSTANT`, `canvas_item.cpp:1525-1527`),
 * for a diagnostic that reports which values are legal. See
 * {@link CLIP_CHILDREN_DISABLED} for why the list ends at 2.
 */
export const CLIP_CHILDREN_MODES = { 0: 'DISABLED', 1: 'ONLY', 2: 'AND_DRAW' };
