/**
 * Semantic linter rule shared by every CanvasItem-derived node — both the
 * Node2D tree and the Control tree — for Godot's own configuration warning,
 * `CanvasItem::get_configuration_warnings()` (canvas_item.cpp:1297-1323):
 *
 *     PackedStringArray warnings = Node::get_configuration_warnings();
 *     if (clip_children_mode != CLIP_CHILDREN_DISABLED && is_inside_tree()) {
 *         bool warned_about_ancestor_clipping = false;
 *         bool warned_about_canvasgroup_ancestor = false;
 *         Node *n = get_parent();
 *         while (n) {
 *             CanvasItem *as_canvas_item = Object::cast_to<CanvasItem>(n);
 *             if (!warned_about_ancestor_clipping && as_canvas_item &&
 *                     as_canvas_item->clip_children_mode != CLIP_CHILDREN_DISABLED) {
 *                 warnings.push_back(...); warned_about_ancestor_clipping = true;
 *             }
 *             CanvasGroup *as_canvas_group = Object::cast_to<CanvasGroup>(n);
 *             if (!warned_about_canvasgroup_ancestor && as_canvas_group) {
 *                 warnings.push_back(...); warned_about_canvasgroup_ancestor = true;
 *             }
 *             if (warned_about_ancestor_clipping && warned_about_canvasgroup_ancestor) break;
 *             n = n->get_parent();
 *         }
 *     }
 *
 * Unlike `CanvasGroup::get_configuration_warnings()` (nodes/2d/canvasgroup/linter.ts),
 * this is gated on the NODE'S OWN `clip_children_mode != CLIP_CHILDREN_DISABLED`
 * (:1300) — a CanvasGroup always wants to clip via backbuffer compositing
 * regardless of that property, but every other CanvasItem only cares about an
 * ancestor stealing its clip if it set one of its own. Registered under the
 * abstract `'CanvasItem'` key via `applicableNodeTypeMatcher` so it reaches
 * every concrete descendant in both trees, the same shape
 * `canvasitem/shared/linterParser.ts` uses for CanvasItem's format validators.
 *
 * This DOES fire alongside CanvasGroup's own two rules when the node in
 * question is itself a CanvasGroup with its own `clip_children` set under a
 * clipping/CanvasGroup ancestor — `CanvasGroup::get_configuration_warnings()`
 * opens with `Node2D::get_configuration_warnings()` (canvas_group.cpp:69),
 * and `Node2D` has no override, so that resolves to this same CanvasItem tier.
 * Godot really does emit both warnings in that case (different wording: "this
 * node" vs "this CanvasGroup"), so two diagnostics there is faithful, not a
 * duplicate to dedupe.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { clipAncestry, clipsChildren } from './clipAncestry.js';

function checkCanvasItemClipAncestry(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;

  // The own-node gate (canvas_item.cpp:1300): no clip of its own means an
  // ancestor stealing the backbuffer is irrelevant to this node.
  if (!clipsChildren(node)) return [];

  const diagnostics: Diagnostic[] = [];
  const { clippingAncestor, canvasGroupAncestor } = clipAncestry(scene, node);

  if (clippingAncestor) {
    diagnostics.push({
      severity: 'warning',
      message: `${node.type} '${node.name}' sets 'clip_children', but ancestor '${clippingAncestor.name}' also clips its children, so this node will not be able to clip its own.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'canvasitem-ancestor-clips-children',
    });
  }

  if (canvasGroupAncestor) {
    diagnostics.push({
      severity: 'warning',
      message: `${node.type} '${node.name}' sets 'clip_children', but ancestor '${canvasGroupAncestor.name}' is a CanvasGroup, so this node will not be able to clip its own children.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'canvasitem-ancestor-is-canvasgroup',
    });
  }

  return diagnostics;
}

const canvasItemClipAncestryRule: LintRule = {
  meta: {
    name: 'valid-canvasitem-clip-ancestry',
    description:
      'Warns when a CanvasItem that clips its own children has an ancestor that also clips, or is a CanvasGroup, either of which wins over this node',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'CanvasItem'),
    emits: [
      { ruleName: 'canvasitem-ancestor-clips-children', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'canvasitem-ancestor-is-canvasgroup', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkCanvasItemClipAncestry,
};

ruleRegistry.register(canvasItemClipAncestryRule);

export { canvasItemClipAncestryRule };
