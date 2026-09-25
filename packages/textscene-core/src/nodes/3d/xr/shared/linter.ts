/**
 * The three configuration warnings of `OpenXRCompositionLayer::get_configuration_warnings()`
 * (openxr_composition_layer.cpp:759-778), all decidable from the `.tscn`. One registration reaches
 * every subclass through `applicableNodeTypeMatcher`, since RuleRegistry matches
 * `applicableNodeTypes` by exact name.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { isExplicitlyHidden, parentTypeVerdict, placementPhrase } from '../../../../linter/parentType.js';
import { isOrthonormalTransform } from '../../../../linter/transformBasis.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { boolSlotValue } from '../../../../godot/index.js';

const PARENT_RULE = 'openxrcompositionlayer-parent-not-xrorigin3d';
const ORTHONORMAL_RULE = 'openxrcompositionlayer-non-orthonormal-transform';
const HOLE_PUNCH_RULE = 'openxrcompositionlayer-hole-punch-sort-order';

// Not modelled: set_layer_viewport's ERR_FAIL_COND_MSG when `use_android_surface` is true (:303-305).
// `layer_viewport` is declared at :151, before `use_android_surface` at :152, so a saved file sets it
// while `use_android_surface` is still false. A co-occurrence rule would fire on files Godot loads,
// and would depend on the keys' textual order.
function checkOpenXRCompositionLayer(context: RuleContext): Diagnostic[] {
  // No applicability check here: RuleRegistry has already filtered by the
  // matcher below, so re-asserting it states the same fact twice and the two
  // can drift.
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;
  const diagnostics: Diagnostic[] = [];

  // openxr_composition_layer.cpp:762-767 casts `get_parent()` with no `parent &&` guard, unlike
  // XRCamera3D, so this warns at the scene root too. An `unknowable` parent (instanced or untyped)
  // stays silent, since a guess would be a false positive on a legal scene.
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
  // (openxr_composition_layer.h:88) and `sort_order` defaults 1 (openxr_composition_layer.h:90), so an
  // explicit `enable_hole_punch = true` with sort_order omitted still warns: the trigger is an
  // explicit opt-in, so `default-omitted` does not apply.
  const holePunchEnabled = boolSlotValue(properties.enable_hole_punch) === true;
  const sortOrder =
    ruleInt(properties.sort_order, 1);
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
