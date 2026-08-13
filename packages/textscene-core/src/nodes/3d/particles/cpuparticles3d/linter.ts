/**
 * Semantic rule for CPUParticles3D — ports the one `get_configuration_warnings`
 * case decidable from scene text alone (cpu_particles_3d.cpp:214-242):
 *
 *   if (!mesh_found) {
 *     warnings.push_back(RTR("Nothing is visible because no mesh has been assigned."));
 *   }
 *
 * `CPUParticles3D::set_mesh` (cpu_particles_3d.cpp:183-192) sets the
 * multimesh's RID to null when `mesh` is unset, so nothing renders — the
 * per-member doc text ("If null, particles will be spheres") is stale; the
 * engine draws nothing, matching this warning. Presence of `mesh` and
 * whether it resolves are both readable straight from the node's properties
 * and the scene's resource tables, same as GridMap's `mesh_library` check
 * (nodes/3d/gridmap/linter.ts) and MeshInstance3D's `mesh` check
 * (nodes/3d/meshinstance3d/linter.ts).
 *
 * The second `get_configuration_warnings` case ("CPUParticles3D animation
 * requires... a StandardMaterial3D whose Billboard Mode is set to \"Particle
 * Billboard\"") needs the *referenced* mesh's surface materials or override
 * material's billboard mode — resolving a resource reference's type and a
 * nested property on it, a level of resource-internals introspection this
 * linter doesn't do anywhere else (the same reason CPUParticles2D's sibling
 * rule, nodes/2d/cpuparticles2d/linter.ts, never ported ITS analogous
 * material/animation check either). Skipped here for the same reason.
 *
 * Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { checkResourceExists, heldResource } from '../../../../linter/resourceChecker.js';

function checkCPUParticles3D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;

  const rawProps = node.properties as unknown as Record<string, string>;
  const diagnostics: Diagnostic[] = [];

  const mesh = heldResource(rawProps.mesh);
  if (mesh === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: 'Nothing is visible because no mesh has been assigned.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'cpuparticles3d-requires-mesh',
    });
  } else if (!checkResourceExists(scene, mesh)) {
    diagnostics.push({
      severity: 'error',
      message: `Mesh resource not found: ${rawProps.mesh}`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'valid-cpuparticles3d-resources',
    });
  }

  return diagnostics;
}

const cpuParticles3DValidationRule: LintRule = {
  meta: {
    name: 'valid-cpuparticles3d-mesh',
    description:
      'Flags a CPUParticles3D with no mesh assigned (renders nothing, per get_configuration_warnings) and validates that an assigned mesh reference resolves',
    category: 'validation',
    applicableNodeTypes: ['CPUParticles3D'],
    emits: [
      { ruleName: 'cpuparticles3d-requires-mesh', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'valid-cpuparticles3d-resources',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the mesh reference names a resource id this file never declares',
        },
      },
    ],
  },
  check: checkCPUParticles3D,
};

ruleRegistry.register(cpuParticles3DValidationRule);

export { cpuParticles3DValidationRule };
