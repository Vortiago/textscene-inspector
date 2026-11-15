/** Reads a CanvasItem's `clip_children`, which a Node2D and a Control parse alike. */

import { enumOr } from '../../../parser/valueParsers';
import { CanvasItemClipChildrenMode } from '../../../godot/scene/canvasItem.js';

const MODES = Object.values(CanvasItemClipChildrenMode);

/**
 * The `clip_children` mode `value` names. `set_clip_children_mode` refuses a value at or past
 * `CLIP_CHILDREN_MAX` (`canvas_item.cpp:1733`), so the mode stays DISABLED.
 */
export function parseClipChildrenMode(value: string | undefined, context: string): number {
  return enumOr(value, CanvasItemClipChildrenMode.DISABLED, MODES, context);
}
