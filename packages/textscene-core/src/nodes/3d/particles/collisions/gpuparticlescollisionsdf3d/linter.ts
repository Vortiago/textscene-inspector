/**
 * GPUParticlesCollisionSDF3D's configuration warning for a zero `bake_mask`
 * (gpu_particles_collision_3d.cpp:526-534), the only such override among the
 * collision and attractor classes. It needs only the node's own `bake_mask`, so
 * the whole check ports.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../../linter/types.js';
import { ruleRegistry } from '../../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../../godot/nodeBaseTypes.js';
import { ruleInt } from '../../../../../linter/validators/commonValidators.js';

function checkGPUParticlesCollisionSDF3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const rawProps = node.properties as Record<string, string>;
  // `bake_mask` defaults to 4294967295, all layers (gpu_particles_collision_3d.cpp:557), and
  // the serialiser omits a default, so only an explicit `bake_mask = 0` fires.
  if (rawProps.bake_mask === undefined) return [];

  // uint32_t setter (gpu_particles_collision_3d.h:183).
  if (ruleInt(rawProps.bake_mask, null, 'uint32') !== 0) return [];

  return [
    {
      severity: 'warning',
      message: `GPUParticlesCollisionSDF3D '${node.name}' has a Bake Mask with no bits enabled, which means baking will not produce any collision for it. Enable at least one bit in the Bake Mask property.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'gpuparticlescollisionsdf3d-empty-bake-mask',
    },
  ];
}

const gpuParticlesCollisionSDF3DBakeMaskRule: LintRule = {
  meta: {
    name: 'valid-gpuparticlescollisionsdf3d-bake-mask',
    description:
      "Warns when a GPUParticlesCollisionSDF3D's Bake Mask has no bits enabled, so baking would produce no collision",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'GPUParticlesCollisionSDF3D'),
    emits: [{ ruleName: 'gpuparticlescollisionsdf3d-empty-bake-mask', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkGPUParticlesCollisionSDF3D,
};

ruleRegistry.register(gpuParticlesCollisionSDF3DBakeMaskRule);

export { gpuParticlesCollisionSDF3DBakeMaskRule };
