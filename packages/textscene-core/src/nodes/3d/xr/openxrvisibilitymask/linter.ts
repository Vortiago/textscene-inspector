/**
 * The XRCamera3D-parent warning of `OpenXRVisibilityMask::get_configuration_warnings()`
 * (openxr_visibility_mask.cpp:67-78). It warns: Godot assigns the mask mesh on
 * `NOTIFICATION_ENTER_TREE` whatever the parent (openxr_visibility_mask.cpp:40-47). A parsed node
 * always enters the tree, so `is_inside_tree()` needs no simulation.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import {
  isExplicitlyHidden,
  parentTypeVerdict,
  placementPhrase,
} from '../../../../linter/parentType.js';

const PARENT_RULE = 'openxrvisibilitymask-parent-not-xrcamera3d';

function checkOpenXRVisibilityMask(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // `is_visible()` reads only the node's own `visible` flag (node_3d.cpp:1127-1130), so an explicitly
  // hidden mask never reaches Godot's check either.
  if (isExplicitlyHidden(properties)) return [];

  const verdict = parentTypeVerdict(scene, node, 'XRCamera3D');
  // Unlike XRCamera3D, this one DOES warn at the root: its own check casts
  // unconditionally, so a null parent fails it.
  if (verdict.kind === 'satisfied' || verdict.kind === 'unknowable') return [];

  const where = placementPhrase(verdict);
  return [
    {
      severity: 'warning',
      message: `OpenXRVisibilityMask '${node.name}' is ${where}. OpenXR visibility mask must have an XRCamera3D node as their parent, the same configuration warning Godot's own editor reports.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: PARENT_RULE,
    },
  ];
}

const openXRVisibilityMaskParentRule: LintRule = {
  meta: {
    name: 'valid-openxrvisibilitymask-parent',
    description:
      "Warns when a visible OpenXRVisibilityMask is not a direct child of an XRCamera3D, Godot's own configuration warning for this node",
    category: 'validation',
    applicableNodeTypes: ['OpenXRVisibilityMask'],
    emits: [{ ruleName: PARENT_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkOpenXRVisibilityMask,
};

ruleRegistry.register(openXRVisibilityMaskParentRule);

export { openXRVisibilityMaskParentRule };
