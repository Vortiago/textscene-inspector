/**
 * Semantic rule for the whole OpenXRCompositionLayer family, from Godot's own
 * `OpenXRCompositionLayer::get_configuration_warnings()`
 * (openxr_composition_layer.cpp:759-778):
 *
 *     if (is_visible() && is_inside_tree()) {
 *         XROrigin3D *origin = Object::cast_to<XROrigin3D>(get_parent());
 *         if (origin == nullptr) {
 *             warnings.push_back(RTR("... must have an XROrigin3D node as their parent."));
 *         }
 *     }
 *     if (!get_transform().basis.is_orthonormal()) {
 *         warnings.push_back(RTR("... must have orthonormalized transforms ..."));
 *     }
 *     if (enable_hole_punch && get_sort_order() >= 0) {
 *         warnings.push_back(RTR("Hole punching won't work as expected unless the sort order is less than zero."));
 *     }
 *
 * One registration reaching every descendant through
 * `applicableNodeTypeMatcher`, because RuleRegistry matches
 * `applicableNodeTypes` by exact name and would otherwise never reach a
 * subclass.
 *
 * All three checks are decidable from the `.tscn` alone, so all three are
 * implemented (none declined):
 *
 * - The parent check casts `get_parent()` UNCONDITIONALLY (no `parent &&`
 *   guard, unlike `XRCamera3D::get_configuration_warnings`), so it warns at
 *   the scene root too — the `OpenXRVisibilityMask`/`BoneAttachment3D` shape,
 *   not the XRCamera3D one. `parentTypeVerdict`'s `unknowable` (an instanced
 *   or untyped parent) stays silent: the same unconditional-cast reasoning
 *   that puts `root` in the warn set says nothing about a parent this linter
 *   cannot type, and guessing would be a false positive on a legal scene.
 * - The transform check reads the node's OWN `Transform3D`, i.e. exactly the
 *   `.tscn`'s `transform` property (or the identity default when absent,
 *   which is trivially orthonormal) — no runtime state needed.
 * - The hole-punch check reads two properties on the SAME node
 *   (`enable_hole_punch`, `sort_order`), both serialised plainly. Godot's
 *   default `sort_order` is `1` (`openxr_composition_layer.h:90`), so an
 *   explicit `enable_hole_punch = true` with no `sort_order` override still
 *   warns — `default-omitted` does not apply here because the TRIGGERING
 *   state (`enable_hole_punch = true`) is an explicit opt-in, not a default.
 *
 * NOT modelled: `set_layer_viewport`'s `ERR_FAIL_COND_MSG(p_viewport !=
 * nullptr, ...)` when `use_android_surface` is already true (:303-305). This
 * looks like a same-node cross-field candidate, but `layer_viewport` is
 * `ADD_PROPERTY`'d at :151, BEFORE `use_android_surface` at :152, so in an
 * editor-saved file (property order follows declaration order) the
 * `layer_viewport` setter runs while `use_android_surface` is still its
 * default `false`, and the guard never fires. A rule that flagged the two
 * keys co-occurring in a `.tscn` would fire on files Godot loads without
 * complaint — and would additionally depend on the keys' TEXTUAL ORDER for a
 * hand-edited file, which no other rule in this codebase models. Left out.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { isExplicitlyHidden, parentTypeVerdict, placementPhrase } from '../../../../linter/parentType.js';
import { parseTransform3D } from '../../../../utils/transform.js';
import { isEqualApprox, isZeroApprox } from '../../../../godot/math.js';
import { parseGodotInt } from '../../../../linter/validators/commonValidators.js';

const PARENT_RULE = 'openxrcompositionlayer-parent-not-xrorigin3d';
const ORTHONORMAL_RULE = 'openxrcompositionlayer-non-orthonormal-transform';
const HOLE_PUNCH_RULE = 'openxrcompositionlayer-hole-punch-sort-order';

/**
 * `Basis::is_orthonormal()` (basis.cpp:103-108): each COLUMN unit length,
 * every pair of columns perpendicular. `parseTransform3D` returns Godot's
 * Basis ROWS (`utils/transform.ts` docblock), so column `i` is component `i`
 * picked from each of the three rows.
 *
 * Returns `null` when the literal does not parse: a malformed `transform` is
 * `linterParser.ts`'s job (inherited from Node3D), not this rule's.
 */
function isOrthonormalTransform(raw: string): boolean | null {
  let transform;
  try {
    transform = parseTransform3D(raw);
  } catch {
    return null;
  }
  const { basis_x, basis_y, basis_z } = transform;
  const col0 = { x: basis_x.x, y: basis_y.x, z: basis_z.x };
  const col1 = { x: basis_x.y, y: basis_y.y, z: basis_z.y };
  const col2 = { x: basis_x.z, y: basis_y.z, z: basis_z.z };
  const dot = (a: typeof col0, b: typeof col0) => a.x * b.x + a.y * b.y + a.z * b.z;
  return (
    isEqualApprox(dot(col0, col0), 1) &&
    isEqualApprox(dot(col1, col1), 1) &&
    isEqualApprox(dot(col2, col2), 1) &&
    isZeroApprox(dot(col0, col1)) &&
    isZeroApprox(dot(col0, col2)) &&
    isZeroApprox(dot(col1, col2))
  );
}

function checkOpenXRCompositionLayer(context: RuleContext): Diagnostic[] {
  // No applicability check here: RuleRegistry has already filtered by the
  // matcher below, so re-asserting it states the same fact twice and the two
  // can drift.
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;
  const diagnostics: Diagnostic[] = [];

  // openxr_composition_layer.cpp:762-767: unconditional cast, so this warns
  // at the scene root too (see docblock).
  if (!isExplicitlyHidden(properties)) {
    const verdict = parentTypeVerdict(scene, node, 'XROrigin3D');
    if (verdict.kind === 'mismatch' || verdict.kind === 'root') {
      const where = placementPhrase(verdict);
      diagnostics.push({
        severity: 'warning',
        message: `${node.type} '${node.name}' is ${where}. OpenXR composition layers must have an XROrigin3D node as their parent, the same configuration warning Godot's own editor reports.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: PARENT_RULE,
      });
    }
  }

  // openxr_composition_layer.cpp:769-771. Absent `transform` is Node3D's
  // identity default, which is trivially orthonormal, so only a present,
  // parseable literal can trip this.
  if (properties.transform !== undefined) {
    const orthonormal = isOrthonormalTransform(properties.transform);
    if (orthonormal === false) {
      diagnostics.push({
        severity: 'warning',
        message: `${node.type} '${node.name}' has a non-orthonormalized transform (scale or shearing). OpenXR composition layers must have orthonormalized transforms, the same configuration warning Godot's own editor reports.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: ORTHONORMAL_RULE,
      });
    }
  }

  // openxr_composition_layer.cpp:773-775. `enable_hole_punch` defaults false
  // (openxr_composition_layer.h:88) and `sort_order` defaults 1 (h:90), so an
  // explicit `enable_hole_punch = true` with sort_order omitted still warns.
  const holePunchEnabled = properties.enable_hole_punch === 'true';
  const sortOrder =
    properties.sort_order === undefined ? 1 : parseGodotInt(properties.sort_order);
  if (holePunchEnabled && sortOrder !== null && sortOrder >= 0) {
    diagnostics.push({
      severity: 'warning',
      message: `${node.type} '${node.name}' has enable_hole_punch on with sort_order ${sortOrder} (>= 0). Hole punching won't work as expected unless the sort order is less than zero, the same configuration warning Godot's own editor reports.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: HOLE_PUNCH_RULE,
    });
  }

  return diagnostics;
}

const openXRCompositionLayerValidationRule: LintRule = {
  meta: {
    name: 'valid-openxrcompositionlayer',
    description:
      "Godot's three OpenXRCompositionLayer configuration warnings: parent must be XROrigin3D, transform must be orthonormal, and hole punching needs a negative sort order",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'OpenXRCompositionLayer'),
    emits: [
      { ruleName: PARENT_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: ORTHONORMAL_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: HOLE_PUNCH_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkOpenXRCompositionLayer,
};

ruleRegistry.register(openXRCompositionLayerValidationRule);

export { openXRCompositionLayerValidationRule };
