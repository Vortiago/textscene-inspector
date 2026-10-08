/**
 * The crossed `_min`/`_max` warning CPUParticles2D and CPUParticles3D share. `rulePrefix` is
 * the node-type slug, so each class keeps its own `<prefix>-param-min-above-max` rule.
 */

import type { Diagnostic } from './types.js';
import { armDiagnostic, type RuleArm } from './ruleArms.js';
import { crossedParamRanges } from '../godot/cpuParticles.js';
import { formatReal } from '../godot/real.js';
import type { RawNode } from '../parser/types.js';

/** The arm under `rulePrefix`, grounded at `setterAt`, the class's own setter that alters the value. */
export function paramMinAboveMaxArm(rulePrefix: string, setterAt: string): RuleArm {
  return {
    severity: 'warning',
    ruleName: `${rulePrefix}-param-min-above-max`,
    grounding: { kind: 'engine', at: setterAt },
  };
}

export function paramMinAboveMaxDiagnostics(
  node: RawNode,
  properties: Record<string, string>,
  arm: RuleArm
): Diagnostic[] {
  return crossedParamRanges(properties).map(({ minKey, maxKey, min, max, movedKey, loadedValue }) =>
    armDiagnostic(
      arm,
      node,
      `'${minKey}' ${formatReal(min)} is above '${maxKey}' ${formatReal(max)}. Godot applies them in the order the file lists them, so '${movedKey}' loads as ${formatReal(loadedValue)}.`
    )
  );
}
