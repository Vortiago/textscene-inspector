/**
 * Semantic lint checks shared by all Light3D-derived nodes. Extracted because
 * the "extreme light energy" warning was copy-pasted verbatim across the three
 * light `linter.ts` files (architecture review S-3) — only the rule-name prefix
 * differed.
 */

import type { Diagnostic } from '../../../../linter/types.js';

const EXTREME_LIGHT_ENERGY_MIN = 0.01;
const EXTREME_LIGHT_ENERGY_MAX = 100;

/**
 * Warn when `light_energy` is implausibly low or high. `rulePrefix` is the
 * node-type slug (e.g. 'spotlight3d') so each light keeps its own rule name
 * (`<prefix>-extreme-energy`). Pushes onto `diagnostics`; no-op when the
 * property is absent or non-numeric.
 */
export function checkLightEnergy(
  rawProps: Record<string, string>,
  nodeName: string,
  nodeType: string,
  rulePrefix: string,
  diagnostics: Diagnostic[]
): void {
  if (rawProps.light_energy === undefined) return;
  const energy = parseFloat(rawProps.light_energy);
  if (Number.isNaN(energy)) return;

  if (energy < EXTREME_LIGHT_ENERGY_MIN) {
    diagnostics.push({
      severity: 'warning',
      message: `Light energy is very low (${energy}). Values below ${EXTREME_LIGHT_ENERGY_MIN} may be barely visible.`,
      nodeName,
      nodeType,
      ruleName: `${rulePrefix}-extreme-energy`,
    });
  } else if (energy > EXTREME_LIGHT_ENERGY_MAX) {
    diagnostics.push({
      severity: 'warning',
      message: `Light energy is very high (${energy}). Values above ${EXTREME_LIGHT_ENERGY_MAX} may cause overexposure.`,
      nodeName,
      nodeType,
      ruleName: `${rulePrefix}-extreme-energy`,
    });
  }
}
