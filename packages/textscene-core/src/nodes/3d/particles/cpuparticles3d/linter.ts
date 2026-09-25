/**
 * CPUParticles3D's semantic rules: the `get_configuration_warnings` case for a missing
 * mesh (cpu_particles_3d.cpp:214-242), and a `*_min` above its `*_max`, which the setters
 * resolve by moving one of the two. Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { heldResource } from '../../../../linter/resourceChecker.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { parseGodotFloat } from '../../../../godot/number.js';
import { formatReal, storedReal } from '../../../../godot/real.js';

/** Every `ADD_PROPERTYI` pair bound to `set_param_min`/`set_param_max` (cpu_particles_3d.cpp:1689-1741). */
const PARAM_PAIRS = [
  'initial_velocity',
  'angular_velocity',
  'orbit_velocity',
  'linear_accel',
  'radial_accel',
  'tangential_accel',
  'damping',
  'angle',
  'scale_amount',
  'hue_variation',
  'anim_speed',
  'anim_offset',
] as const;

// `set_mesh` (cpu_particles_3d.cpp:183-192) nulls the multimesh's RID, so nothing
// renders, whatever the member doc says about spheres.
// Not ported: the Particle Billboard material case needs the referenced mesh's
// materials, resource internals this linter reads nowhere, CPUParticles2D included.
function checkMissingMesh(node: RuleContext['node']): Diagnostic[] {
  const rawProps = node.properties as unknown as Record<string, string>;
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

/**
 * A crossed pair's earlier line loads as the later one's value. `set_param_min` raises the
 * max to a min above it, and `set_param_max` lowers the min to a max below it
 * (cpu_particles_3d.cpp:293-296, :310-313). One authored key alone moves only the default.
 * It compares the stored `real_t` values, so `0.30000001` above `0.3` is no crossing.
 */
function checkParamRanges(node: RuleContext['node']): Diagnostic[] {
  if (!isValidProperties(node.properties)) return [];
  const rawProps = node.properties as Record<string, string>;
  const keys = Object.keys(rawProps);
  const diagnostics: Diagnostic[] = [];

  for (const pair of PARAM_PAIRS) {
    const minKey = `${pair}_min`;
    const maxKey = `${pair}_max`;
    const writtenMin = parseGodotFloat(rawProps[minKey] ?? '');
    const writtenMax = parseGodotFloat(rawProps[maxKey] ?? '');
    if (writtenMin === null || writtenMax === null) continue;
    const min = storedReal(writtenMin);
    const max = storedReal(writtenMax);
    if (!(min > max)) continue;

    const isMinFirst = keys.indexOf(minKey) < keys.indexOf(maxKey);
    const [movedKey, loadedValue] = isMinFirst ? [minKey, max] : [maxKey, min];
    diagnostics.push({
      severity: 'warning',
      message: `'${minKey}' ${formatReal(min)} is above '${maxKey}' ${formatReal(max)}. Godot applies them in the order the file lists them, so '${movedKey}' loads as ${formatReal(loadedValue)}.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'cpuparticles3d-param-min-above-max',
    });
  }
  return diagnostics;
}

function checkCPUParticles3D(context: RuleContext): Diagnostic[] {
  return [...checkMissingMesh(context.node), ...checkParamRanges(context.node)];
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
