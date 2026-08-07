/**
 * Semantic linter rule for the XRNode3D family, from Godot's own configuration
 * warning, `XRNode3D::get_configuration_warnings()` (xr_nodes.cpp:495-520):
 *
 *     if (is_visible() && is_inside_tree()) {
 *         Node *parent = get_parent();
 *         XROrigin3D *origin = Object::cast_to<XROrigin3D>(parent);
 *         if (parent && origin == nullptr) {
 *             warnings.push_back(RTR("XRNode3D may not function as expected
 *             without an XROrigin3D node as its parent."));
 *         };
 *
 *         if (tracker_name == "") {
 *             warnings.push_back(RTR("No tracker name is set."));
 *         }
 *
 *         if (pose_name == "") {
 *             warnings.push_back(RTR("No pose is set."));
 *         }
 *
 *         if (SceneTree::is_fti_enabled_in_project() && is_physics_interpolated()) {
 *             warnings.push_back(RTR("XRNode3D should have physics_interpolation_mode
 *             set to OFF in order to avoid jitter."));
 *         }
 *     }
 *
 * Neither XRAnchor3D nor XRController3D overrides `get_configuration_warnings`
 * (xr_nodes.h:133-175 declares no such override for either), so both inherit
 * this check verbatim — including its literal wording, which always says
 * "XRNode3D" even when the actual node is one of the two subclasses. Reaching
 * both needs `applicableNodeTypeMatcher`: `RuleRegistry` matches
 * `applicableNodeTypes` by exact name and would otherwise never widen past the
 * declaring class.
 *
 * Two of the four warnings are modelled here:
 *  - the parent check, the same shape as `xrcamera3d/linter.ts`'s (root stays
 *    silent: the guard reads `if (parent && ...)`, not an unconditional cast),
 *    resolved through `parentTypeVerdict` rather than hand-rolled.
 *  - the empty-pose check. `pose_name` defaults to `&"default"`
 *    (`XRNode3D::XRNode3D`'s field initializer; `doc/classes/XRNode3D.xml`'s
 *    `pose` default agrees), so `pose_name == ""` is a real, NON-default state
 *    a `.tscn` can carry (`pose = &""`), not the property's own default.
 *    `set_tracker` (xr_nodes.cpp:301-302) resets `pose_name` back to
 *    `&"default"` as a side effect, so this check reads properties in the
 *    order the FILE lists them, not Godot's post-load state, and assumes
 *    Godot's own `ADD_PROPERTY` order (`tracker` before `pose`,
 *    xr_nodes.cpp:249,253) — the order every serialised `.tscn` actually
 *    carries. A hand-edited file that reorders the two keys could disagree
 *    with a live Godot session; this is not order-sensitive by choice.
 *
 * The other two are not modelled:
 *  - "No tracker name is set" fires exactly when `tracker_name` sits at its OWN
 *    default (`&""`, both the field's default construction and
 *    `doc/classes/XRNode3D.xml`'s `tracker` default) — a value a `.tscn` never
 *    serialises, since Godot omits keys equal to default. The only way to flag
 *    it would be to treat a MISSING `tracker` key as the trigger, but a missing
 *    key IS Godot's own default state, not a defect, so this is not modelled.
 *  - the physics-interpolation warning needs `SceneTree::is_fti_enabled_in_project()`,
 *    a project setting no `.tscn` carries.
 *
 * Advisory, hence warnings: nothing about either value is malformed.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { isExplicitlyHidden, parentTypeVerdict } from '../../../../linter/parentType.js';

const PARENT_RULE = 'xrnode3d-parent-not-xrorigin3d';
const NO_POSE_RULE = 'xrnode3d-no-pose-set';

/** `""` or `&""` — `pose` explicitly cleared to empty (xr_nodes.cpp:510-512). */
const EMPTY_STRING_NAME_RE = /^&?""$/;

function checkXRNode3D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // An explicitly hidden node never reaches Godot's own check either.
  if (isExplicitlyHidden(properties)) return [];

  const diagnostics: Diagnostic[] = [];

  const verdict = parentTypeVerdict(scene, node, 'XROrigin3D');
  // xr_nodes.cpp:502's `if (parent && ...)`: no parent at all, no warning — the
  // same divergence from OpenXR/BoneAttachment's shape that xrcamera3d/linter.ts
  // documents.
  if (verdict.kind === 'mismatch') {
    diagnostics.push({
      severity: 'warning',
      message: `${node.type} '${node.name}' is a child of a ${verdict.parent.type} node. XRNode3D may not function as expected without an XROrigin3D node as its parent, the same configuration warning Godot's own editor reports.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: PARENT_RULE,
    });
  }

  const pose = properties.pose;
  if (pose !== undefined && EMPTY_STRING_NAME_RE.test(pose.trim())) {
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
      { ruleName: PARENT_RULE, severity: 'warning' },
      { ruleName: NO_POSE_RULE, severity: 'warning' },
    ],
  },
  check: checkXRNode3D,
};

ruleRegistry.register(xrNode3DValidationRule);

export { xrNode3DValidationRule };
