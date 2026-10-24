/**
 * The crossed `_min`/`_max` finding that CPUParticles2D, CPUParticles3D and ParticleProcessMaterial
 * share. `rulePrefix` is the type slug, so each class keeps its own `<prefix>-param-min-above-max` rule.
 */

import type { Diagnostic } from './types.js';
import { armDiagnostic, type RuleArm } from './ruleArms.js';
import { crossedParamRanges } from '../godot/scene/particleParamRange.js';
import { formatReal } from '../godot/math/real.js';
import type { RawNode } from '../parser/types.js';

/** The arm under `rulePrefix`, grounded at `setterAt`, the class's own setter that alters the value. */
export function paramMinAboveMaxArm(rulePrefix: string, setterAt: string): RuleArm {
  return {
    severity: 'warning',
    ruleName: `${rulePrefix}-param-min-above-max`,
    grounding: { kind: 'engine', at: setterAt },
  };
}

/** One finding per crossed pair of `stems`, on the key the file lists first, which loads changed. */
export function paramMinAboveMaxFindings(
  properties: Record<string, string>,
  stems: readonly string[]
): { property: string; message: string }[] {
  return crossedParamRanges(properties, stems).map(({ minKey, maxKey, min, max, movedKey }) => ({
    property: movedKey,
    message: `'${minKey}' ${formatReal(min)} is above '${maxKey}' ${formatReal(max)}. Godot applies them in the order the file lists them, so '${movedKey}' loads as ${formatReal(movedKey === minKey ? max : min)}.`,
  }));
}

/** One diagnostic on `node` per crossed pair of `stems`. */
export function paramMinAboveMaxDiagnostics(
  node: RawNode,
  properties: Record<string, string>,
  stems: readonly string[],
  arm: RuleArm
): Diagnostic[] {
  return paramMinAboveMaxFindings(properties, stems).map(({ message }) => armDiagnostic(arm, node, message));
}
