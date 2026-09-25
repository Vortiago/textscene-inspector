/**
 * CPUParticles3D's `get_configuration_warnings` case for a missing mesh
 * (cpu_particles_3d.cpp:214-242). `set_mesh` (cpu_particles_3d.cpp:183-192) nulls
 * the multimesh's RID, so nothing renders, whatever the member doc says about
 * spheres. Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { heldResource } from '../../../../linter/resourceChecker.js';

// Not ported: the Particle Billboard material case needs the referenced mesh's
// materials, resource internals this linter reads nowhere, CPUParticles2D included.
function checkCPUParticles3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  const rawProps = node.properties as unknown as Record<string, string>;
  const diagnostics: Diagnostic[] = [];

  if (heldResource(rawProps.mesh) === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: 'Nothing is visible because no mesh has been assigned.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'cpuparticles3d-requires-mesh',
    });
  }

  return diagnostics;
}

const cpuParticles3DValidationRule: LintRule = {
  meta: {
    name: 'valid-cpuparticles3d-mesh',
    description:
      'Flags a CPUParticles3D with no mesh assigned (renders nothing, per get_configuration_warnings)',
    category: 'validation',
    applicableNodeTypes: ['CPUParticles3D'],
    emits: [
      { ruleName: 'cpuparticles3d-requires-mesh', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkCPUParticles3D,
};

ruleRegistry.register(cpuParticles3DValidationRule);

export { cpuParticles3DValidationRule };
