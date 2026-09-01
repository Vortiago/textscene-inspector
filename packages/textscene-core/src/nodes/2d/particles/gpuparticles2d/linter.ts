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
import {
  checkResourceExists,
  heldResource,
  resourceSlotIsEmpty,
} from '../../../../linter/resourceChecker.js';

function checkGPUParticles2D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
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

  // A reference that names nothing is the error tier everywhere else in this
  // linter, and the 3D twin reports it: an empty slot and a dangling id are
  // different defects, and checking only emptiness let the second through.
  //
  // Each slot is read at its own `props.<name>` call site, never through a
  // variable or a computed key: `clearedResourceSlot.test.ts` scrapes these
  // exact spellings, and an argument it cannot bracket drops the slot out of
  // that sweep in silence.
  const notFound = (key: string, raw: string | undefined): Diagnostic => ({
    severity: 'error',
    message: `GPUParticles2D '${key}' resource not found: ${raw}`,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'valid-gpuparticles2d-resources',
  });

  const processMaterial = heldResource(props.process_material);
  if (processMaterial !== undefined && !checkResourceExists(scene, processMaterial)) {
    diagnostics.push(notFound('process_material', props.process_material));
  }

  const texture = heldResource(props.texture);
  if (texture !== undefined && !checkResourceExists(scene, texture)) {
    diagnostics.push(notFound('texture', props.texture));
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
      {
        ruleName: 'valid-gpuparticles2d-resources',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the reference names a resource id this file never declares',
        },
      },
    ],
  },
  check: checkGPUParticles2D,
};

ruleRegistry.register(gpuParticles2DPreviewRule);

export { gpuParticles2DPreviewRule };
