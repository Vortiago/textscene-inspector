/**
 * Ports the one arm of `get_configuration_warnings` (gpu_particles_2d.cpp:373)
 * that scene text decides: a missing `process_material`. The others read the
 * material's PARAM_ANIM_SPEED/OFFSET, or the project's rendering method (trail and
 * sub_emitter under Compatibility), which no single `.tscn` holds.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../../linter/ruleArms.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { resourceSlotIsEmpty } from '../../../../linter/resourceChecker.js';

const arms = {
  missingProcessMaterial: groundedArm('gpuparticles2d-missing-process-material', {
    kind: 'configuration-warning',
  }),
} as const satisfies RuleArms<string>;

function checkGPUParticles2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const diagnostics: Diagnostic[] = [];

  if (resourceSlotIsEmpty(props.process_material)) {
    reportArm(
      diagnostics,
      arms.missingProcessMaterial,
      node,
      "GPUParticles2D has no 'process_material' assigned, so no behavior is imprinted and Godot renders it as-is (a configuration warning in the editor, not an error)."
    );
  }

  return diagnostics;
}

const gpuParticles2DPreviewRule: LintRule = {
  meta: {
    name: 'valid-gpuparticles2d-process-material',
    description:
      "Flags a GPUParticles2D with no process_material, mirroring Godot's own configuration warning",
    category: 'validation',
    applicableNodeTypes: ['GPUParticles2D'],
    emits: armEmits(arms),
  },
  check: checkGPUParticles2D,
};

ruleRegistry.register(gpuParticles2DPreviewRule);

export { gpuParticles2DPreviewRule };
