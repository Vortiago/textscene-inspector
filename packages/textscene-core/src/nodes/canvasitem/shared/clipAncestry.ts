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
import { CLIP_CHILDREN_DISABLED } from '../../../godot/canvasItem.js';
import { parseGodotInt } from '../../../linter/validators/commonValidators.js';

/** `clip_children` on `candidate`, per canvas_item.h:72-75 — non-zero and readable. */
export function clipsChildren(candidate: TscnNode): boolean {
  if (!isValidProperties(candidate.properties)) return false;
  const raw = candidate.properties.clip_children;
  // Absent means DISABLED: Godot omits a property at its default (ADR-0032).
  if (raw === undefined) return false;
  const parsed = parseGodotInt(raw);
  return parsed !== null && parsed !== CLIP_CHILDREN_DISABLED;
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
