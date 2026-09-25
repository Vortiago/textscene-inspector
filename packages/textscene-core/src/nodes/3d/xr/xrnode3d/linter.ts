/**
 * Two of the four warnings of `XRNode3D::get_configuration_warnings()` (xr_nodes.cpp:495-520): a
 * parent that is not an XROrigin3D, and an empty pose. XRAnchor3D and XRController3D do not override
 * it (xr_nodes.h:133-175), so `applicableNodeTypeMatcher` reaches them, since `RuleRegistry` matches
 * `applicableNodeTypes` by exact name. Godot's wording says "XRNode3D" for both subclasses.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { isExplicitlyHidden, parentTypeVerdict } from '../../../../linter/parentType.js';
import { literalText } from '../../../../godot/index.js';

const PARENT_RULE = 'xrnode3d-parent-not-xrorigin3d';
const NO_POSE_RULE = 'xrnode3d-no-pose-set';

// Not modelled: "No tracker name is set" fires only at `tracker`'s default `&""`
// (doc/classes/XRNode3D.xml), which Godot omits, and a missing key is not a defect. The
// physics-interpolation warning needs `SceneTree::is_fti_enabled_in_project()`, a project setting.
function checkXRNode3D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // An explicitly hidden node never reaches Godot's check either.
  if (isExplicitlyHidden(properties)) return [];

  const diagnostics: Diagnostic[] = [];

  const verdict = parentTypeVerdict(scene, node, 'XROrigin3D');
  // xr_nodes.cpp:502 reads `if (parent && ...)`, so a parentless node stays silent, as in
  // xrcamera3d/linter.ts.
  if (verdict.kind === 'mismatch') {
    diagnostics.push({
      severity: 'warning',
      message: `${node.type} '${node.name}' is a child of a ${verdict.parent.type} node. XRNode3D may not function as expected without an XROrigin3D node as its parent, the same configuration warning Godot's own editor reports.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: PARENT_RULE,
    });
  }

  // `pose_name` defaults to `&"default"` (doc/classes/XRNode3D.xml agrees), so `pose = &""` is a real
  // state. `set_tracker` (xr_nodes.cpp:301-302) resets `pose_name`, so this assumes Godot's
  // `ADD_PROPERTY` order, `tracker` before `pose` (xr_nodes.cpp:249,253), which every saved file keeps.
  const pose = properties.pose;
  // `literalText` rather than a hand-rolled regex: it takes every spelling
  // of an empty name, `&""` and `''` alike (xr_nodes.cpp:510-512).
  if (pose !== undefined && literalText(pose) === '') {
    diagnostics.push({
      severity: 'warning',
      message: `${node.type} '${node.name}' has its pose cleared to an empty string. No pose is set, the same configuration warning Godot's own editor reports.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: NO_POSE_RULE,
    });
  }

  return diagnostics;
}

const xrNode3DValidationRule: LintRule = {
  meta: {
    name: 'valid-xrnode3d',
    description:
      "Mirrors two of XRNode3D::get_configuration_warnings' checks (a parent that is not an XROrigin3D, an explicitly emptied pose) across XRNode3D and the subclasses that inherit the check unmodified (XRAnchor3D, XRController3D)",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'XRNode3D'),
    emits: [
      { ruleName: PARENT_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: NO_POSE_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkXRNode3D,
};

ruleRegistry.register(xrNode3DValidationRule);

export { xrNode3DValidationRule };
