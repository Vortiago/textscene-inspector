/**
 * Semantic linter rule for XRCamera3D, from Godot's own configuration warning,
 * `XRCamera3D::get_configuration_warnings()` (xr_nodes.cpp:94-111):
 *
 *     if (is_visible() && is_inside_tree()) {
 *         // Warn if the node has a parent which isn't an XROrigin3D!
 *         Node *parent = get_parent();
 *         XROrigin3D *origin = Object::cast_to<XROrigin3D>(parent);
 *         if (parent && origin == nullptr) {
 *             warnings.push_back(RTR("XRCamera3D may not function as expected
 *             without an XROrigin3D node as its parent."));
 *         };
 *     }
 *
 * Unlike NavigationAgent's or OpenXRVisibilityMask's parent checks (both of
 * which warn at the scene root too, because `cast_to<T>(nullptr)` is null and
 * their conditions never guard on the parent existing), this one reads
 * `if (parent && origin == nullptr)`: Godot itself only warns when there IS a
 * parent and it fails the cast, so a parentless XRCamera3D stays silent here.
 *
 * `cast_to<XROrigin3D>` also succeeds for a subclass, so this resolves the
 * parent's ancestry (`descendsFrom`) rather than comparing the type string.
 * XROrigin3D is not a registered slice yet (it lands in a later wave), but
 * `NODE_BASE_TYPES` is derived from Godot's own class catalog independently of
 * slice registration, so the lookup already resolves.
 *
 * `is_visible()` (Node3D::is_visible(), node_3d.cpp:1127-1130) reads only the
 * node's own `visible` flag, not the inherited-in-tree value, matching the
 * gate `openxrvisibilitymask/linter.ts` already uses for the same Godot
 * pattern — an explicitly hidden camera never reaches Godot's own check
 * either, so this rule stays quiet on `visible = false` without simulating the
 * rest of the tree's visibility.
 *
 * Advisory, hence a warning: the scene still loads and every property is
 * well-formed; only the AR/VR headset placement heuristic is off.
 *
 * The second warning in the same function (an OFF `physics_interpolation_mode`
 * while FTI is project-enabled) is not modelled: it is gated on
 * `SceneTree::is_fti_enabled_in_project()`, a project setting no `.tscn`
 * carries, so this linter has nothing to check it against.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { findParentNode } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';

const PARENT_RULE = 'xrcamera3d-parent-not-xrorigin3d';

function checkXRCamera3DParent(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // Node3D::is_visible() (node_3d.cpp:1127-1130): an explicitly hidden camera
  // never reaches Godot's own check either.
  if (properties.visible === 'false') return [];

  const parent = findParentNode(scene.nodes, node);
  // xr_nodes.cpp:97's `if (parent && ...)`: no parent at all, no warning —
  // the one place this rule diverges from the NavigationAgent/OpenXR shape.
  if (!parent) return [];
  // An instanced parent's type lives in another file the linter never opens.
  if (parent.instance || !parent.type) return [];
  if (descendsFrom(parent.type, 'XROrigin3D')) return [];

  return [
    {
      severity: 'warning',
      message: `XRCamera3D '${node.name}' is a child of a ${parent.type} node. XRCamera3D may not function as expected without an XROrigin3D node as its parent, the same configuration warning Godot's own editor reports.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: PARENT_RULE,
    },
  ];
}

const xrCamera3DParentRule: LintRule = {
  meta: {
    name: 'valid-xrcamera3d-parent',
    description:
      "Warns when a visible XRCamera3D has a parent that is not an XROrigin3D, Godot's own configuration warning for this node",
    category: 'validation',
    applicableNodeTypes: ['XRCamera3D'],
    emits: [{ ruleName: PARENT_RULE, severity: 'warning' }],
  },
  check: checkXRCamera3DParent,
};

ruleRegistry.register(xrCamera3DParentRule);

export { xrCamera3DParentRule };
