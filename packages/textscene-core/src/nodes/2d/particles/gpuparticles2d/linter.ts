/**
 * Ports the one arm of `get_configuration_warnings` (gpu_particles_2d.cpp:373)
 * that scene text decides: a missing `process_material`. The others read the
 * material's PARAM_ANIM_SPEED/OFFSET, or the project's rendering method (trail and
 * sub_emitter under Compatibility), which no single `.tscn` holds.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { resourceSlotIsEmpty } from '../../../../linter/resourceChecker.js';

function checkGPUParticles2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const diagnostics: Diagnostic[] = [];

  if (resourceSlotIsEmpty(props.process_material)) {
    diagnostics.push({
      severity: 'warning',
      message:
        "GPUParticles2D has no 'process_material' assigned, so no behavior is imprinted and Godot renders it as-is (a configuration warning in the editor, not an error).",
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'gpuparticles2d-missing-process-material',
    });
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
    emits: [
      { ruleName: 'gpuparticles2d-missing-process-material', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkGPUParticles2D,
};

ruleRegistry.register(gpuParticles2DPreviewRule);

export { gpuParticles2DPreviewRule };
