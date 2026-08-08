/**
 * Semantic linter rule for CanvasGroup — Godot's own configuration warning,
 * `CanvasGroup::get_configuration_warnings()` (canvas_group.cpp:67-95):
 *
 *     Node *n = get_parent();
 *     while (n) {
 *         CanvasItem *as_canvas_item = Object::cast_to<CanvasItem>(n);
 *         if (!warned_about_ancestor_clipping && as_canvas_item &&
 *                 as_canvas_item->get_clip_children_mode() != CLIP_CHILDREN_DISABLED) {
 *             warnings.push_back(...); warned_about_ancestor_clipping = true;
 *         }
 *         CanvasGroup *as_canvas_group = Object::cast_to<CanvasGroup>(n);
 *         if (!warned_about_canvasgroup_ancestor && as_canvas_group) {
 *             warnings.push_back(...); warned_about_canvasgroup_ancestor = true;
 *         }
 *         if (warned_about_ancestor_clipping && warned_about_canvasgroup_ancestor) break;
 *         n = n->get_parent();
 *     }
 *
 * Both a clipping ancestor and a CanvasGroup ancestor break the backbuffer this
 * node relies on, so both arms need the WHOLE ancestor chain, not just the direct
 * parent: each fires at most once, naming the FIRST (nearest) ancestor that
 * trips it, and the walk keeps going until both have fired or the root is
 * reached. `clip_children` is a serialised CanvasItem property
 * (canvas_item.cpp:1465-1466, `ClipChildrenMode` in canvas_item.h:72-75:
 * DISABLED=0, ONLY=1, AND_DRAW=2); the engine's test is `!= DISABLED`, so any
 * non-zero value trips it, and Godot omits the key entirely at its default 0
 * (ADR-0032's absence rule), so a missing key must NOT trip the rule.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { findParentNode, isValidProperties } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';
import { CLIP_CHILDREN_DISABLED } from '../../../godot/canvasItem.js';

/** `clip_children` on `ancestor`, per canvas_item.h:72-75 — non-zero and parseable. */
function clipsChildren(ancestor: TscnNode): boolean {
  if (!isValidProperties(ancestor.properties)) return false;
  const raw = ancestor.properties.clip_children;
  // Absent means DISABLED: Godot omits a property at its default (ADR-0032).
  if (raw === undefined) return false;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed !== CLIP_CHILDREN_DISABLED;
}

function checkCanvasGroup(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  let clippingAncestor: TscnNode | null = null;
  let canvasGroupAncestor: TscnNode | null = null;
  let current = findParentNode(scene.nodes, node);
  while (current && (!clippingAncestor || !canvasGroupAncestor)) {
    if (!clippingAncestor && descendsFrom(current.type, 'CanvasItem') && clipsChildren(current)) {
      clippingAncestor = current;
    }
    if (!canvasGroupAncestor && descendsFrom(current.type, 'CanvasGroup')) {
      canvasGroupAncestor = current;
    }
    current = findParentNode(scene.nodes, current);
  }

  if (clippingAncestor) {
    diagnostics.push({
      severity: 'warning',
      message: `CanvasGroup '${node.name}' has ancestor '${clippingAncestor.name}' which clips its children, so this CanvasGroup will not function properly.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'canvasgroup-ancestor-clips-children',
    });
  }

  if (canvasGroupAncestor) {
    diagnostics.push({
      severity: 'warning',
      message: `CanvasGroup '${node.name}' has ancestor '${canvasGroupAncestor.name}' which is a CanvasGroup, so this CanvasGroup will not function properly.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'canvasgroup-nested-in-canvasgroup',
    });
  }

  return diagnostics;
}

const canvasGroupAncestryRule: LintRule = {
  meta: {
    name: 'valid-canvasgroup-ancestry',
    description:
      'Warns when a CanvasGroup has an ancestor that clips its children or is itself a CanvasGroup, either of which breaks the backbuffer compositing this node relies on',
    category: 'validation',
    applicableNodeTypes: ['CanvasGroup'],
    emits: [
      { ruleName: 'canvasgroup-ancestor-clips-children', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'canvasgroup-nested-in-canvasgroup', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkCanvasGroup,
};

ruleRegistry.register(canvasGroupAncestryRule);

export { canvasGroupAncestryRule };
