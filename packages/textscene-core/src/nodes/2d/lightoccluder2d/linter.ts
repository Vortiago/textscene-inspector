/**
 * Semantic linter rule for LightOccluder2D, from Godot's own configuration
 * warning, `LightOccluder2D::get_configuration_warnings()`
 * (light_occluder_2d.cpp:265-278):
 *
 *     if (occluder_polygon.is_null()) {
 *         warnings.push_back(RTR("An occluder polygon must be set (or drawn) for this occluder to take effect."));
 *     }
 *     if (occluder_polygon.is_valid() && occluder_polygon->get_polygon().is_empty()) {
 *         warnings.push_back(RTR("The occluder polygon for this occluder is empty. Please draw a polygon."));
 *     }
 *
 * The property is `occluder` (`ADD_PROPERTY(PropertyInfo(Variant::OBJECT,
 * "occluder", PROPERTY_HINT_RESOURCE_TYPE, "OccluderPolygon2D"), ...)`,
 * light_occluder_2d.cpp:298) — a resource reference that defaults to null and
 * is genuinely absent from a `.tscn` whenever unset, so an absent key IS the
 * trigger, unlike the properties this repo declines as `default-omitted`.
 *
 * The second warning (an occluder set, but its OWN polygon array empty) needs
 * the referenced `OccluderPolygon2D` resource's `polygon` VALUE, which is
 * runtime/resource content this linter does not resolve — out of scope here.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';

const RULE_NAME = 'lightoccluder2d-requires-occluder';

function checkLightOccluder2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  if (node.properties.occluder !== undefined) return [];

  return [
    {
      severity: 'warning',
      message: `LightOccluder2D '${node.name}' has no occluder polygon set. An occluder polygon must be set (or drawn) for this occluder to take effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE_NAME,
    },
  ];
}

const lightOccluder2DRequiresOccluderRule: LintRule = {
  meta: {
    name: 'valid-lightoccluder2d-occluder',
    description: 'Warns when a LightOccluder2D has no occluder polygon resource set',
    category: 'validation',
    applicableNodeTypes: ['LightOccluder2D'],
    emits: [{ ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkLightOccluder2D,
};

ruleRegistry.register(lightOccluder2DRequiresOccluderRule);

export { lightOccluder2DRequiresOccluderRule };
