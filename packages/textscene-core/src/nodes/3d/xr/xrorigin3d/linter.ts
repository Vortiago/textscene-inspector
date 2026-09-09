/**
 * Semantic linter rule for XROrigin3D, from Godot's own configuration warning,
 * `XROrigin3D::get_configuration_warnings()` (xr_nodes.cpp:682-709):
 *
 *     if (is_visible() && is_inside_tree()) {
 *         bool has_camera = false;
 *         for (int i = 0; !has_camera && i < get_child_count(); i++) {
 *             XRCamera3D *camera = Object::cast_to<XRCamera3D>(get_child(i));
 *             if (camera) { has_camera = true; }
 *         }
 *         if (!has_camera) {
 *             warnings.push_back(RTR("XROrigin3D requires an XRCamera3D child node."));
 *         }
 *
 *         if (!get_scale().is_equal_approx(Vector3(1, 1, 1))) {
 *             warnings.push_back(RTR("Changing the scale on the XROrigin3D node
 *             is not supported. Change the World Scale instead."));
 *         }
 *     }
 *
 *     bool xr_enabled = GLOBAL_GET("xr/shaders/enabled");
 *     if (!xr_enabled) {
 *         warnings.push_back(RTR("XR shaders are not enabled in project settings. ..."));
 *     }
 *
 * The third warning reads a PROJECT SETTING (`xr/shaders/enabled`) no `.tscn`
 * carries, and it sits OUTSIDE the visibility/tree guard — it would fire for
 * every XROrigin3D in this repo's corpus regardless of content — so it is not
 * modelled.
 *
 * The other two ARE checkable from the file alone:
 *  - the camera-child check reads `get_child(i)` directly, so it is answered
 *    by the node's own `children`, never a NodePath resolution. An instanced
 *    or untyped child is treated as possibly-a-camera (never a confident
 *    "missing"), the same caution `parentTypeVerdict`'s `unknowable` applies
 *    to a PARENT this linter cannot see into.
 *  - the scale check reads `get_scale()`, which is derived from the
 *    `transform` Basis — the only pose property Node3D actually SERIALISES.
 *    `position`/`rotation`/`scale` are `PROPERTY_USAGE_EDITOR`-only
 *    (node_3d.cpp:1526-1531: no `PROPERTY_USAGE_STORAGE` bit), so a `.tscn`
 *    never carries a bare `scale = Vector3(...)` line to read instead.
 *    `Basis::get_scale()` folds a reflection's sign across ALL THREE axes via
 *    a single `det_sign` (core/math/basis.cpp:297-321), whereas this repo's
 *    `decomposeTransform3D` (three.js convention) folds a reflection's sign
 *    into ONE axis only — but the two conventions still agree on the one fact
 *    this check needs, whether the result equals `(1, 1, 1)` exactly: any
 *    reflection leaves at least one axis negative under EITHER convention,
 *    and with no reflection neither convention alters the magnitudes at all.
 *
 * Advisory, hence warnings: nothing about either value is malformed.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isExplicitlyHidden, isTypeUnknowable } from '../../../../linter/parentType.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { hasNonUnitScale3D } from '../../../../linter/transformBasis.js';

const CAMERA_CHILD_RULE = 'xrorigin3d-missing-camera-child';
const SCALE_RULE = 'xrorigin3d-unsupported-scale';

/**
 * `get_child(i)` cast to `XRCamera3D` (xr_nodes.cpp:687-693). An instanced or
 * untyped child's real type is unknowable from this file, so it is never
 * treated as a confident "missing" — only as "unknowable", which stays quiet.
 */
function cameraChildVerdict(node: TscnNode): 'satisfied' | 'unknowable' | 'missing' {
  let unknown = false;
  for (const child of node.children) {
    if (isTypeUnknowable(child)) {
      unknown = true;
      continue;
    }
    if (descendsFrom(child.type, 'XRCamera3D')) return 'satisfied';
  }
  return unknown ? 'unknowable' : 'missing';
}

/**
 * `!get_scale().is_equal_approx(Vector3(1, 1, 1))` (xr_nodes.cpp:698), read
 * from the serialised `transform` Basis — see the module docblock for why the
 * sign-convention difference from `decomposeTransform3D` doesn't matter here.
 *
 * A zero-determinant basis is not specially handled: `decomposeTransform3D`
 * falls back to `(1, 1, 1)` for that degenerate case (three.js convention),
 * where Godot's `SIGN(0)` would zero out `get_scale()` entirely and warn. A
 * fully collapsed basis is not a value any real editor or script produces for
 * an origin's transform, so this stays with the shared, tested decomposition
 * rather than hand-rolling a determinant-sign special case for it.
 */
function checkXROrigin3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // An explicitly hidden origin never reaches Godot's own check either.
  if (isExplicitlyHidden(properties)) return [];

  const diagnostics: Diagnostic[] = [];

  if (cameraChildVerdict(node) === 'missing') {
    diagnostics.push({
      severity: 'warning',
      message: `XROrigin3D '${node.name}' has no XRCamera3D child. XROrigin3D requires an XRCamera3D child node, the same configuration warning Godot's own editor reports.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: CAMERA_CHILD_RULE,
    });
  }

  if (hasNonUnitScale3D(properties.transform)) {
    diagnostics.push({
      severity: 'warning',
      message: `XROrigin3D '${node.name}' has a non-identity scale. Changing the scale on the XROrigin3D node is not supported, change the World Scale (world_scale) instead — the same configuration warning Godot's own editor reports.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: SCALE_RULE,
    });
  }

  return diagnostics;
}

const xrOrigin3DValidationRule: LintRule = {
  meta: {
    name: 'valid-xrorigin3d',
    description:
      "Mirrors two of XROrigin3D::get_configuration_warnings' checks: a required XRCamera3D child, and an unsupported non-identity scale",
    category: 'validation',
    applicableNodeTypes: ['XROrigin3D'],
    emits: [
      { ruleName: CAMERA_CHILD_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: SCALE_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkXROrigin3D,
};

ruleRegistry.register(xrOrigin3DValidationRule);

export { xrOrigin3DValidationRule };
