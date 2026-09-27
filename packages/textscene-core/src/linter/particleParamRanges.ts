/**
 * The crossed `_min`/`_max` warning CPUParticles2D and CPUParticles3D share. `rulePrefix` is
 * the node-type slug, so each class keeps its own `<prefix>-param-min-above-max` rule.
 */

import type { Diagnostic } from './types.js';
import type { TscnNode } from '../parser/types.js';
import { crossedParamRanges } from '../godot/cpuParticles.js';
import { formatReal } from '../godot/real.js';

export function paramMinAboveMaxDiagnostics(
  node: TscnNode,
  properties: Record<string, string>,
  rulePrefix: string
): Diagnostic[] {
  return crossedParamRanges(properties).map(({ minKey, maxKey, min, max, movedKey, loadedValue }) => ({
    severity: 'warning',
    message: `'${minKey}' ${formatReal(min)} is above '${maxKey}' ${formatReal(max)}. Godot applies them in the order the file lists them, so '${movedKey}' loads as ${formatReal(loadedValue)}.`,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: `${rulePrefix}-param-min-above-max`,
  }));
}
