/**
 * Semantic linter rule for GPUParticlesCollisionSDF3D: ports Godot's own
 * `GPUParticlesCollisionSDF3D::get_configuration_warnings()`
 * (gpu_particles_collision_3d.cpp:526-534):
 *
 *     PackedStringArray warnings = GPUParticlesCollision3D::get_configuration_warnings();
 *     if (bake_mask == 0) {
 *         warnings.push_back(RTR("The Bake Mask has no bits enabled, which means
 *         baking will not produce any collision for this GPUParticlesCollisionSDF3D.
 *         To resolve this, enable at least one bit in the Bake Mask property."));
 *     }
 *
 * Fully decidable from scene text: `bake_mask` is a plain int property, no
 * referenced-resource internals or NodePath target type needed, so the whole
 * check ports. `GPUParticlesCollision3D` (and every sibling collision/attractor
 * class in this `.cpp`) has no `get_configuration_warnings` override of its own;
 * `GPUParticlesCollisionSDF3D` is the only one, so the base call in the quoted
 * source falls through to the generic default and there is nothing else to port.
 *
 * `bake_mask` defaults to 4294967295, all layers, per
 * `ADD_PROPERTY(PropertyInfo(Variant::INT, "bake_mask", PROPERTY_HINT_LAYERS_3D_RENDER), ...)`
 * (gpu_particles_collision_3d.cpp:557), and Godot's serializer omits a property
 * left at its default. So an ABSENT key means "all layers enabled", not zero;
 * only an EXPLICIT `bake_mask = 0` fires this.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../../linter/types.js';
import { ruleRegistry } from '../../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../../linter/nodeBaseTypes.js';
import { ruleInt } from '../../../../../linter/validators/commonValidators.js';

function checkGPUParticlesCollisionSDF3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const rawProps = node.properties as Record<string, string>;
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
