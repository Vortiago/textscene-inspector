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
import { CPU_PARTICLES_PARAMS } from '../../../../godot/cpuParticles.js';
import { replayPositions } from '../../../../godot/propertyReplay.js';

/** Each `ADD_PROPERTYI` pair bound to `set_param_min`/`set_param_max` (cpu_particles_3d.cpp:1689-1741). */
const PARAM_KEY_PAIRS = CPU_PARTICLES_PARAMS.map((param) => [`${param}_min`, `${param}_max`] as const);

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

/**
 * A crossed pair's earlier line loads as the later one's value. `set_param_min` raises the
 * max to a min above it, and `set_param_max` lowers the min to a max below it
 * (cpu_particles_3d.cpp:293-296, :310-313). One authored key alone moves only the default.
 * It compares the stored `real_t` values, so `0.30000001` above `0.3` is no crossing.
 */
function checkParamRanges(node: RuleContext['node'], rawProps: Record<string, string>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const [minKey, maxKey] of PARAM_KEY_PAIRS) {
    const writtenMin = parseGodotFloat(rawProps[minKey] ?? '');
    const writtenMax = parseGodotFloat(rawProps[maxKey] ?? '');
    if (writtenMin === null || writtenMax === null) continue;
    const min = storedReal(writtenMin);
    const max = storedReal(writtenMax);
    if (!(min > max)) continue;

    const isMaxLater = replayPositions(rawProps, minKey, [maxKey])[maxKey]!.late;
    const [movedKey, loadedValue] = isMaxLater ? [minKey, max] : [maxKey, min];
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
  const { node } = context;
  const rawProps = node.properties;
  if (!isValidProperties(rawProps)) return [];
  return [...checkMissingMesh(node, rawProps), ...checkParamRanges(node, rawProps)];
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
