/**
 * Semantic linter rule for CanvasGroup, ported from
 * `CanvasGroup::get_configuration_warnings()` (canvas_group.cpp:67-95). A clipping
 * ancestor and a CanvasGroup ancestor each break this node's backbuffer, so each
 * warns once over the whole chain, naming the nearest ancestor that trips it.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../linter/ruleArms.js';
import { clipAncestry } from '../../canvasitem/shared/clipAncestry.js';

const arms = {
  ancestorClipsChildren: groundedArm('canvasgroup-ancestor-clips-children', {
    kind: 'configuration-warning',
  }),
  nestedInCanvasGroup: groundedArm('canvasgroup-nested-in-canvasgroup', { kind: 'configuration-warning' }),
} as const satisfies RuleArms<string>;

function checkCanvasGroup(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // No own-node gate, unlike the CanvasItem tier: a CanvasGroup always clips through
  // backbuffer compositing. An ancestor's `clip_children` (canvas_item.cpp:1465-1466,
  // `ClipChildrenMode` in canvas_item.h:72-75) trips at any mode but DISABLED (0),
  // and an absent key is DISABLED.
  const { clippingAncestor, canvasGroupAncestor } = clipAncestry(scene, node);

  if (clippingAncestor) {
    reportArm(
      diagnostics,
      arms.ancestorClipsChildren,
      node,
      `CanvasGroup '${node.name}' has ancestor '${clippingAncestor.name}' which clips its children, so this CanvasGroup will not function properly.`
    );
  }

  if (canvasGroupAncestor) {
    reportArm(
      diagnostics,
      arms.nestedInCanvasGroup,
      node,
      `CanvasGroup '${node.name}' has ancestor '${canvasGroupAncestor.name}' which is a CanvasGroup, so this CanvasGroup will not function properly.`
    );
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
    emits: armEmits(arms),
  },
  check: checkCanvasGroup,
};

ruleRegistry.register(canvasGroupAncestryRule);

export { canvasGroupAncestryRule };
