/**
 * Range-advisory arms shared by all Light3D-derived nodes. The `light_energy`
 * band was copy-pasted verbatim across the four light `linter.ts` files
 * (architecture review S-3) — only the rule-name prefix differed — so the bounds
 * and messages live here once and flow through the shared `rangeAdvisories`
 * combinator.
 *
 * Both bands are one-sided: every Light3D range hint ends in `or_greater`, so
 * the high end is open and only a negative value is out of band. `Light3D::set_param`
 * guards the param INDEX, not the value, so neither end is enforced.
 */

import type { RangeArm } from '../../../../linter/rangeAdvisory.js';

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
      message: (energy) =>
        `Light energy is negative (${energy}). The editor range for light_energy starts at 0.`,
    },
  ];
}

/**
 * The `<prop>_range` **Range advisory** shared by point/spot lights, whose two
 * hints are identical apart from the property name.
 */
export function lightRangeArms(rulePrefix: string): RangeArm[] {
  return [
    {
      // light_3d.cpp:639 (omni_range) / :672 (spot_range) — PROPERTY_HINT_RANGE "0,4096,0.001,or_greater"
      under: 0,
      ruleName: `${rulePrefix}-negative-range`,
      message: (range) =>
        `Light range is negative (${range}). The editor range for this property starts at 0.`,
    },
  ];
}
