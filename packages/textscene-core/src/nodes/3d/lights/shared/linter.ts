/**
 * Semantic linter rule shared by every Light3D-derived node, from Godot's own
 * `Light3D::get_configuration_warnings()` (light_3d.cpp:181-189):
 *
 *     PackedStringArray warnings = VisualInstance3D::get_configuration_warnings();
 *     if (!get_scale().is_equal_approx(Vector3(1, 1, 1))) {
 *         warnings.push_back(RTR("A light's scale does not affect the visual size of the light."));
 *     }
 *     return warnings;
 *
 * One registration reaching every descendant through `applicableNodeTypeMatcher` —
 * DirectionalLight3D, OmniLight3D, SpotLight3D, and this repo's AreaLight3D
 * (which does not exist in Godot 4.6.3's ClassDB at all, but is chained to
 * Light3D in `nodeBaseTypes.ts`'s `UNCATALOGUED` table and already reuses
 * Light3D's other shared range-advisory checks the same way). Light3D itself
 * is `GDREGISTER_ABSTRACT_CLASS` and appears in no `.tscn`, and `RuleRegistry`
 * matches `applicableNodeTypes` by exact name.
 *
 * `get_scale()` is `Basis::get_scale()` (core/math/basis.cpp:299-321): the
 * unsigned column magnitudes of the transform's basis (`get_scale_abs()`),
 * with a single `det_sign` folded across all three. `decomposeTransform3D`
 * (three.js convention) instead folds a reflection's sign into ONE axis only —
 * but the two conventions still agree on the one fact this check needs,
 * whether the result equals `(1, 1, 1)` exactly: any reflection leaves at
 * least one axis negative under EITHER convention, and with no reflection
 * neither convention alters the magnitudes at all. `xrorigin3d/linter.ts`
 * relies on the same reasoning for its own, structurally identical,
 * `get_scale()` check.
 *
 * `transform` is the only pose property Node3D actually serialises —
 * `position`/`rotation`/`scale` are `PROPERTY_USAGE_EDITOR`-only
 * (node_3d.cpp:1526-1531, no `PROPERTY_USAGE_STORAGE` bit) — so decomposing
 * the basis is the only way to read this from a `.tscn`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { hasNonUnitScale3D } from '../../../../utils/transform.js';

const SCALE_RULE = 'light3d-non-unit-scale';

function checkLight3DScale(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = node.properties as unknown as Record<string, string>;

  if (!hasNonUnitScale3D(properties.transform)) return [];

  return [
    {
      severity: 'warning',
      message: `${node.type} '${node.name}' has a non-unit scale. A light's scale does not affect the visual size of the light, the same configuration warning Godot's own editor reports.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: SCALE_RULE,
    },
  ];
}

const light3DScaleValidationRule: LintRule = {
  meta: {
    name: 'valid-light3d-scale',
    description:
      "Mirrors Light3D::get_configuration_warnings' own-scale check across every concrete light type",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Light3D'),
    emits: [{ ruleName: SCALE_RULE, severity: 'warning' }],
  },
  check: checkLight3DScale,
};

ruleRegistry.register(light3DScaleValidationRule);

export { light3DScaleValidationRule };
