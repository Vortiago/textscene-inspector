/**
 * The ancestor sweep behind Godot's two clip-children configuration warnings.
 *
 * `CanvasItem::get_configuration_warnings()` (canvas_item.cpp:1302-1320) and
 * `CanvasGroup::get_configuration_warnings()` (canvas_group.cpp:71-89) run the
 * SAME climb and differ only in what gates it and how the two warnings are
 * worded. Keeping the climb here means an engine change to it lands once; the
 * two rules keep their own diagnostics, which is the part that genuinely
 * differs.
 */

import type { TscnNode, TscnScene } from '../../../parser/types.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';
import { sweepAncestors } from '../../../linter/parentType.js';
import { CLIP_CHILDREN_DISABLED, CLIP_CHILDREN_MAX } from '../../../godot/index.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';

/**
 * `clip_children` on `candidate`: a mode Godot both STORES and treats as
 * clipping, per `clip_children_mode != CLIP_CHILDREN_DISABLED`
 * (canvas_item.cpp:1302, :1308).
 *
 * `ruleInt` is `null` for a literal no int slot holds, which matters here more
 * than anywhere: an inequality is the one comparison NaN does NOT fall out of,
 * so a value off the number line would read as a clipping mode. Below
 * CLIP_CHILDREN_MAX, because the ERR_FAIL_COND at canvas_item.cpp:1733 refuses
 * that write and the field keeps DISABLED.
 */
export function clipsChildren(candidate: TscnNode): boolean {
  if (!isValidProperties(candidate.properties)) return false;
  const raw = candidate.properties.clip_children;
  // Absent means DISABLED: Godot omits a property at its default (ADR-0032).
  if (raw === undefined) return false;
  // `ruleInt` already narrows: the setter sees int32, so `4294967295` is -1.
  const mode = ruleInt(raw);
  if (mode === null) return false;
  return mode !== CLIP_CHILDREN_DISABLED && mode < CLIP_CHILDREN_MAX;
}

export interface ClipAncestry {
  /** The nearest CanvasItem ancestor that clips its own children. */
  clippingAncestor?: TscnNode;
  /** The nearest CanvasGroup ancestor, which clips via backbuffer compositing. */
  canvasGroupAncestor?: TscnNode;
}

/**
 * The nearest ancestor of each kind, or neither.
 *
 * `sweepAncestors` rather than a terminating walk: Godot's loop climbs to the
 * root without letting a type end it, so an ancestor whose class lives in
 * another scene subtracts nothing from what the ones above it prove. Nearest
 * wins because the climb starts at the parent.
 */
export function clipAncestry(scene: TscnScene, node: TscnNode): ClipAncestry {
  const found: ClipAncestry = {};
  sweepAncestors(scene, node, (ancestor) => {
    if (
      found.clippingAncestor === undefined &&
      descendsFrom(ancestor.type, 'CanvasItem') &&
      clipsChildren(ancestor)
    ) {
      found.clippingAncestor = ancestor;
    }
    if (found.canvasGroupAncestor === undefined && descendsFrom(ancestor.type, 'CanvasGroup')) {
      found.canvasGroupAncestor = ancestor;
    }
  });
  return found;
}
