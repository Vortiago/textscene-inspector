/**
 * Range-advisory arms shared by all Light3D-derived nodes. The `light_energy`
 * band was copy-pasted verbatim across the four light `linter.ts` files
 * (architecture review S-3) — only the rule-name prefix differed — so the bounds
 * and messages live here once and flow through the shared `rangeAdvisories`
 * combinator.
 *
 * All three bands are one-sided: every Light3D range hint ends in `or_greater`,
 * so the high end is open and only a negative value is out of band. `Light3D::set_param`
 * guards the param INDEX, not the value, so neither end is enforced.
 */

import type { RangeArm } from '../../../../linter/rangeAdvisory.js';
import type { Diagnostic } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';

/**
 * The `light_energy` **Range advisory**. `rulePrefix` is the node-type slug
 * (e.g. 'spotlight3d') so each light keeps its own `<prefix>-negative-energy`
 * rule name.
 */
export function lightEnergyArms(rulePrefix: string): RangeArm[] {
  return [
    {
      // light_3d.cpp:389 — light_energy PROPERTY_HINT_RANGE "0,16,0.001,or_greater"
      under: 0,
      ruleName: `${rulePrefix}-negative-energy`,
      cite: 'light_3d.cpp:389',
      message: (energy) =>
        `Light energy is negative (${energy}). The editor range for light_energy starts at 0.`,
    },
  ];
}

/**
 * `omni_range`'s **Range advisory**. light_3d.cpp:639, PROPERTY_HINT_RANGE
 * "0,4096,0.001,or_greater,exp".
 */
export function omniRangeArms(rulePrefix: string): RangeArm[] {
  return [
    {
      under: 0,
      ruleName: `${rulePrefix}-negative-range`,
      cite: 'light_3d.cpp:639',
      message: (range) =>
        `Light range is negative (${range}). The editor range for this property starts at 0.`,
    },
  ];
}

/**
 * `spot_range`'s **Range advisory**. light_3d.cpp:672, PROPERTY_HINT_RANGE
 * "0,4096,0.001,or_greater,exp,suffix:m". Same bound as `omni_range` (both 0,
 * open top) but a separate hint line, so it gets its own citation rather than
 * sharing `omniRangeArms`'s.
 */
export function spotRangeArms(rulePrefix: string): RangeArm[] {
  return [
    {
      under: 0,
      ruleName: `${rulePrefix}-negative-range`,
      cite: 'light_3d.cpp:672',
      message: (range) =>
        `Light range is negative (${range}). The editor range for this property starts at 0.`,
    },
  ];
}

/**
 * OmniLight3D's and SpotLight3D's shared `light_projector` check — the SAME
 * `RTR` text at both sites:
 *
 *     if (!has_shadow() && get_projector().is_valid()) {
 *         warnings.push_back(RTR("Projector texture only works with shadows active."));
 *     }
 *
 * (light_3d.cpp:623-625 for OmniLight3D, :659-661 for SpotLight3D — `has_shadow()`
 * reads the `shadow_enabled` property, light_3d.cpp:402). `light_projector` is the
 * serialised key (light_3d.cpp:393), not the C++ member `projector`.
 *
 * `rulePrefix` is the node-type slug, so each light keeps its own
 * `<prefix>-projector-without-shadow` rule name.
 */
export function projectorWithoutShadowDiagnostic(
  node: TscnNode,
  rulePrefix: string
): Diagnostic | null {
  const properties = node.properties as unknown as Record<string, string>;
  if (!properties.light_projector) return null;
  if (properties.shadow_enabled === 'true') return null;

  return {
    severity: 'warning',
    message: `${node.type} '${node.name}' has a light_projector texture set, but shadow_enabled is not true. Projector texture only works with shadows active.`,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: `${rulePrefix}-projector-without-shadow`,
  };
}
