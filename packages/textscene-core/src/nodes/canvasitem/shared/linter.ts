/**
 * Godot's `CanvasItem::get_configuration_warnings()` (canvas_item.cpp:1297-1323) for every
 * CanvasItem descendant in the Node2D and Control trees, registered under `'CanvasItem'` through
 * `applicableNodeTypeMatcher`, as `canvasitem/shared/linterParser.ts` registers the validators.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { clipAncestry, clipsChildren } from './clipAncestry.js';
import { armEmits, reportArm, type RuleArms } from '../../../linter/ruleArms.js';

const arms = {
  ancestorClipsChildren: {
    severity: 'warning',
    ruleName: 'canvasitem-ancestor-clips-children',
    grounding: { kind: 'configuration-warning' },
  },
  ancestorIsCanvasGroup: {
    severity: 'warning',
    ruleName: 'canvasitem-ancestor-is-canvasgroup',
    grounding: { kind: 'configuration-warning' },
  },
} as const satisfies RuleArms<string>;

function checkCanvasItemClipAncestry(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;

  // The own-node gate (canvas_item.cpp:1300), which CanvasGroup's rules lack: a CanvasGroup always
  // clips. On a clipping CanvasGroup this fires beside those rules, as in Godot, since
  // `CanvasGroup::get_configuration_warnings()` opens with this tier's (canvas_group.cpp:69).
  if (!clipsChildren(node)) return [];

  const diagnostics: Diagnostic[] = [];
  const { clippingAncestor, canvasGroupAncestor } = clipAncestry(scene, node);

  if (clippingAncestor) {
    reportArm(
      diagnostics,
      arms.ancestorClipsChildren,
      node,
      `${node.type} '${node.name}' sets 'clip_children', but ancestor '${clippingAncestor.name}' also clips its children, so this node will not be able to clip its own.`
    );
  }

  if (canvasGroupAncestor) {
    reportArm(
      diagnostics,
      arms.ancestorIsCanvasGroup,
      node,
      `${node.type} '${node.name}' sets 'clip_children', but ancestor '${canvasGroupAncestor.name}' is a CanvasGroup, so this node will not be able to clip its own children.`
    );
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
    emits: armEmits(arms),
  },
  check: checkCanvasItemClipAncestry,
};

ruleRegistry.register(canvasItemClipAncestryRule);

export { canvasItemClipAncestryRule };
