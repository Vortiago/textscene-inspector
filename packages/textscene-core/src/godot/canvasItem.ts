/** CanvasItem's own enums, as the engine declares them. */

/**
 * `CanvasItem::ClipChildrenMode` (`scene/main/canvas_item.h:71-75`), the serialised values of
 * `clip_children`. CanvasGroup's rule asks only whether an ancestor clips, as Godot tests
 * `get_clip_children_mode() != CLIP_CHILDREN_DISABLED` (`canvas_group.cpp:76`,
 * `canvas_item.cpp:1308`), so this is a named engine fact rather than a bare `!== 0`.
 */
export const CLIP_CHILDREN_DISABLED = 0;

/**
 * `CLIP_CHILDREN_MAX` (`canvas_item.h:75`), a count sentinel, not a mode, so the legal span is
 * 0..2. `set_clip_children_mode` fails on `>= CLIP_CHILDREN_MAX` (`canvas_item.cpp:1733`) after an
 * int32 narrowing, so only 3..2147483647 trips it. Measured on 4.6.3: `4294967295`, the
 * serialiser's `-1`, lands negative, passes the guard and clips.
 */
export const CLIP_CHILDREN_MAX = 3;

/**
 * The mode names Godot binds (`BIND_ENUM_CONSTANT`, `canvas_item.cpp:1525-1527`), for a
 * diagnostic that reports the legal values. {@link CLIP_CHILDREN_MAX} says why it ends at 2.
 */
export const CLIP_CHILDREN_MODES = { 0: 'DISABLED', 1: 'ONLY', 2: 'AND_DRAW' };
