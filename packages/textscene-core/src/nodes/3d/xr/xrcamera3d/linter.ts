/**
 * The XROrigin3D-parent warning of `XRCamera3D::get_configuration_warnings()` (xr_nodes.cpp:94-111).
 * It warns: the scene loads, and only the headset placement heuristic is off. The second warning is
 * gated on `SceneTree::is_fti_enabled_in_project()`, a project setting no `.tscn` carries, so it is
 * not modelled.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isExplicitlyHidden, parentTypeVerdict } from '../../../../linter/parentType.js';
import { armDiagnostic, armEmits, groundedArm, type RuleArms } from '../../../../linter/ruleArms.js';

const arms = {
  parentNotOrigin: groundedArm('xrcamera3d-parent-not-xrorigin3d', { kind: 'configuration-warning' }),
} as const satisfies RuleArms<string>;

function checkXRCamera3DParent(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // `is_visible()` reads only the node's own `visible` flag (node_3d.cpp:1127-1130), so an
  // explicitly hidden camera never reaches Godot's check either.
  if (isExplicitlyHidden(properties)) return [];

  // `cast_to<XROrigin3D>` accepts a subclass, so the verdict resolves the parent's ancestry.
  const verdict = parentTypeVerdict(scene, node, 'XROrigin3D');
  // xr_nodes.cpp:97 reads `if (parent && ...)`, so a parentless camera stays silent, unlike the
  // OpenXR and BoneAttachment3D checks, which warn at the root.
  if (verdict.kind !== 'mismatch') return [];

  return [
    armDiagnostic(
      arms.parentNotOrigin,
      node,
      `XRCamera3D '${node.name}' is a child of a ${verdict.parent.type} node. XRCamera3D may not function as expected without an XROrigin3D node as its parent, the same configuration warning Godot's own editor reports.`
    ),
  ];
}

const xrCamera3DParentRule: LintRule = {
  meta: {
    name: 'valid-xrcamera3d-parent',
    description:
      "Warns when a visible XRCamera3D has a parent that is not an XROrigin3D, Godot's own configuration warning for this node",
    category: 'validation',
    applicableNodeTypes: ['XRCamera3D'],
    emits: armEmits(arms),
  },
  check: checkXRCamera3DParent,
};

ruleRegistry.register(xrCamera3DParentRule);

export { xrCamera3DParentRule };
