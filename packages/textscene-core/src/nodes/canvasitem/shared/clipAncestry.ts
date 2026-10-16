/**
 * The ancestor sweep behind Godot's two clip-children configuration warnings.
 * `CanvasItem::get_configuration_warnings()` (canvas_item.cpp:1302-1320) and
 * `CanvasGroup::get_configuration_warnings()` (canvas_group.cpp:71-89) run the same climb and
 * differ only in the gate and the wording, which the two rules keep.
 */

import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { sweepAncestors } from '../../../linter/parentType.js';
import {
  CANVAS_ITEM_CLIP_CHILDREN_MODE_COUNT,
  CanvasItemClipChildrenMode,
} from '../../../godot/scene/canvasItem.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';
import type { RawNode, RawScene } from '../../../parser/types.js';

/**
 * `clip_children` on `candidate`: a mode Godot stores and treats as clipping, per
 * `clip_children_mode != CLIP_CHILDREN_DISABLED` (canvas_item.cpp:1302, :1308). `ruleInt` gives
 * `null` for a literal no int slot holds, since NaN passes an inequality. Below CLIP_CHILDREN_MAX,
 * because the ERR_FAIL_COND at canvas_item.cpp:1733 refuses that write and the field keeps DISABLED.
 */
export function clipsChildren(candidate: RawNode): boolean {
  const raw = candidate.rawProperties.clip_children;
  // Absent means DISABLED: Godot omits a property at its default (ADR-0032).
  if (raw === undefined) return false;
  // `ruleInt` already narrows: the setter sees int32, so `4294967295` is -1.
  const mode = ruleInt(raw);
  if (mode === null) return false;
  return mode !== CanvasItemClipChildrenMode.DISABLED && mode < CANVAS_ITEM_CLIP_CHILDREN_MODE_COUNT;
}

interface ClipAncestry {
  /** The nearest CanvasItem ancestor that clips its own children. */
  clippingAncestor?: RawNode;
  /** The nearest CanvasGroup ancestor, which clips through backbuffer compositing. */
  canvasGroupAncestor?: RawNode;
}

/**
 * The nearest ancestor of each kind, or neither. `sweepAncestors`, not a terminating walk: Godot
 * climbs to the root without letting a type end it, so an ancestor whose class lives in another
 * scene subtracts nothing from what the ones above it prove. Nearest wins: the climb starts at the parent.
 */
export function clipAncestry(scene: RawScene, node: RawNode): ClipAncestry {
  const found: ClipAncestry = {};
  sweepAncestors(scene, node, (ancestor) => {
    if (
      found.clippingAncestor === undefined &&
      descendsFromClass(ancestor.type, 'CanvasItem') &&
      clipsChildren(ancestor)
    ) {
      found.clippingAncestor = ancestor;
    }
    if (found.canvasGroupAncestor === undefined && descendsFromClass(ancestor.type, 'CanvasGroup')) {
      found.canvasGroupAncestor = ancestor;
    }
  });
  return found;
}
