/**
 * CPUParticles3D's semantic rules: the `get_configuration_warnings` case for a missing
 * mesh (cpu_particles_3d.cpp:214-242), and a `*_min` above its `*_max`, which the setters
 * resolve by moving one of the two. Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { heldResource } from '../../../../linter/resourceChecker.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { paramMinAboveMaxDiagnostics } from '../../../../linter/particleParamRanges.js';

// `set_mesh` (cpu_particles_3d.cpp:183-192) nulls the multimesh's RID, so nothing
// renders, whatever the member doc says about spheres.
// Not ported: the Particle Billboard material case needs the referenced mesh's
// materials, resource internals this linter reads nowhere, CPUParticles2D included.
function checkMissingMesh(node: RuleContext['node'], rawProps: Record<string, string>): Diagnostic[] {
  if (heldResource(rawProps.mesh) !== undefined) return [];
  return [
    {
      severity: 'warning',
      message: 'Nothing is visible because no mesh has been assigned.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'cpuparticles3d-requires-mesh',
    },
  ];
}

function checkCPUParticles3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const rawProps = node.properties;
  if (!isValidProperties(rawProps)) return [];
  return [...checkMissingMesh(node, rawProps), ...paramMinAboveMaxDiagnostics(node, rawProps, 'cpuparticles3d')];
}

const cpuParticles3DValidationRule: LintRule = {
  meta: {
    name: 'valid-cpuparticles3d-properties',
    description:
      'Flags a CPUParticles3D with no mesh assigned (renders nothing, per get_configuration_warnings), and a *_min above its *_max, where one of the two loads as the other',
    category: 'validation',
    applicableNodeTypes: ['CPUParticles3D'],
    emits: [
      { ruleName: 'cpuparticles3d-requires-mesh', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'cpuparticles3d-param-min-above-max',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'cpu_particles_3d.cpp:293-313' },
      },
    ],
  },
  check: checkCPUParticles3D,
};

ruleRegistry.register(cpuParticles3DValidationRule);

export { cpuParticles3DValidationRule };
