/**
 * The crossed `_min`/`_max` warning CPUParticles2D and CPUParticles3D share. `rulePrefix` is
 * the node-type slug, so each class keeps its own `<prefix>-param-min-above-max` rule.
 */

import type { Diagnostic } from './types.js';
import type { TscnNode } from '../parser/types.js';
import { armDiagnostic, type RuleArms } from './ruleArms.js';
import { crossedParamRanges } from '../godot/cpuParticles.js';
import { formatReal } from '../godot/real.js';

/** The arm under `rulePrefix`, grounded at `setterAt`, the class's own setter that alters the value. */
export function paramMinAboveMaxArms(rulePrefix: string, setterAt: string) {
  const arms = {
    paramMinAboveMax: {
      severity: 'warning',
      ruleName: `${rulePrefix}-param-min-above-max`,
      grounding: { kind: 'engine', at: setterAt },
    },
  } as const satisfies RuleArms<'paramMinAboveMax'>;
  return arms;
}

export type ParamMinAboveMaxArms = ReturnType<typeof paramMinAboveMaxArms>;

export function paramMinAboveMaxDiagnostics(
  node: TscnNode,
  properties: Record<string, string>,
  arms: ParamMinAboveMaxArms
): Diagnostic[] {
  return crossedParamRanges(properties).map(({ minKey, maxKey, min, max, movedKey, loadedValue }) =>
    armDiagnostic(
      arms.paramMinAboveMax,
      node,
      `'${minKey}' ${formatReal(min)} is above '${maxKey}' ${formatReal(max)}. Godot applies them in the order the file lists them, so '${movedKey}' loads as ${formatReal(loadedValue)}.`
    )
  );
}
