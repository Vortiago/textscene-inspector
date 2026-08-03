/**
 * Semantic rule for GPUParticles2D — the one arm of Godot's own
 * `get_configuration_warnings` (gpu_particles_2d.cpp:373) decidable from scene
 * text alone.
 *
 * The other three arms need state this static linter does not have:
 *   - the CanvasItemMaterial animation check reads the `process_material`
 *     resource's own PARAM_ANIM_SPEED/PARAM_ANIM_OFFSET internals;
 *   - the trail/Compatibility-renderer and sub_emitter/Compatibility-renderer
 *     warnings both depend on the PROJECT's active rendering method, which
 *     lives outside any single `.tscn`.
 * Those are skipped rather than ported.
 *
 * Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';

function checkGPUParticles2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const diagnostics: Diagnostic[] = [];

  if (!props.process_material) {
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
    emits: [{ ruleName: 'gpuparticles2d-missing-process-material', severity: 'warning' }],
  },
  check: checkGPUParticles2D,
};

ruleRegistry.register(gpuParticles2DPreviewRule);

export { gpuParticles2DPreviewRule };
