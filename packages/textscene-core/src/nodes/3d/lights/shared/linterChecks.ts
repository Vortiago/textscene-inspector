/**
 * Range-advisory arms shared by all Light3D-derived nodes. The `light_energy`
 * band was copy-pasted verbatim across the four light `linter.ts` files
 * (architecture review S-3) — only the rule-name prefix differed — so the bounds
 * and messages live here once and flow through the shared `rangeAdvisories`
 * combinator.
 */

import type { RangeArm } from '../../../../linter/rangeAdvisory.js';

const EXTREME_LIGHT_ENERGY_MIN = 0.01;
const EXTREME_LIGHT_ENERGY_MAX = 100;

/**
 * The two `light_energy` **Range advisory** arms — implausibly low or high.
 * `rulePrefix` is the node-type slug (e.g. 'spotlight3d') so each light keeps its
 * own `<prefix>-extreme-energy` rule name.
 */
export function lightEnergyArms(rulePrefix: string): RangeArm[] {
  return [
    {
      under: EXTREME_LIGHT_ENERGY_MIN,
      ruleName: `${rulePrefix}-extreme-energy`,
      message: (energy) =>
        `Light energy is very low (${energy}). Values below ${EXTREME_LIGHT_ENERGY_MIN} may be barely visible.`,
    },
    {
      over: EXTREME_LIGHT_ENERGY_MAX,
      ruleName: `${rulePrefix}-extreme-energy`,
      message: (energy) =>
        `Light energy is very high (${energy}). Values above ${EXTREME_LIGHT_ENERGY_MAX} may cause overexposure.`,
    },
  ];
}
