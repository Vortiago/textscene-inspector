/**
 * Semantic linter rule for OpenXRVisibilityMask, from Godot's own configuration
 * warning, `OpenXRVisibilityMask::get_configuration_warnings()`
 * (openxr_visibility_mask.cpp:67-78):
 *
 *     if (is_visible() && is_inside_tree()) {
 *         XRCamera3D *camera = Object::cast_to<XRCamera3D>(get_parent());
 *         if (camera == nullptr) {
 *             warnings.push_back(RTR("OpenXR visibility mask must have an XRCamera3D node as their parent."));
 *         }
 *     }
 *
 * `is_visible()` on Node3D reads only the node's own `visible` flag
 * (node_3d.cpp:1127-1130), not the inherited-in-tree value, so an explicitly
 * hidden mask stays quiet here the same way Godot's own check does. Every
 * node reachable from a parsed `.tscn` is, by construction, going into the
 * tree, so `is_inside_tree()` needs no separate simulation.
 *
 * Advisory, hence a warning: nothing about the value is malformed, and Godot
 * still assigns the mask mesh on `NOTIFICATION_ENTER_TREE` regardless of the
 * parent's type (openxr_visibility_mask.cpp:40-47) — this is Godot's own
 * placement hint, not an engine-enforced bound.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { findParentNode } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';

const PARENT_RULE = 'openxrvisibilitymask-parent-not-xrcamera3d';

function checkOpenXRVisibilityMask(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // Node3D::is_visible() (node_3d.cpp:1127-1130): an explicitly hidden mask
  // never reaches Godot's own check either.
  if (properties.visible === 'false') return [];

  const parent = findParentNode(scene.nodes, node);
  // An instanced parent's type lives in another file the linter never opens.
  if (parent && (parent.instance || !parent.type)) return [];
  if (parent && descendsFrom(parent.type, 'XRCamera3D')) return [];

  const where = parent ? `a child of a ${parent.type} node` : 'the scene root';
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
    emits: [{ ruleName: PARENT_RULE, severity: 'warning' }],
  },
  check: checkOpenXRVisibilityMask,
};

ruleRegistry.register(openXRVisibilityMaskParentRule);

export { openXRVisibilityMaskParentRule };
