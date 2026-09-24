/**
 * OccluderInstance3D's configuration warnings (occluder_instance_3d.cpp:693-720)
 * that the node's own properties decide: a zero `bake_mask` and a missing
 * `occluder`. A missing optional resource warns and never errors.
 */

// Not ported: the `use_occlusion_culling` project setting needs `project.godot`. The
// occluder vertex-count warnings need the referenced resource, usually an external
// `.occ` or `.tres` this repo never reads, and occlusion culling only affects
// performance, which the previewer never simulates.

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';

function checkOccluderInstance3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const rawProps = node.properties as unknown as Record<string, string>;
  const diagnostics: Diagnostic[] = [];

  // occluder_instance_3d.cpp:700-702. The serialiser omits the default (4294967295, all
  // layers), so only an explicit `bake_mask = 0` fires. The setter takes uint32_t
  // (occluder_instance_3d.h:196).
  if (rawProps.bake_mask !== undefined && ruleInt(rawProps.bake_mask, null, 'uint32') === 0) {
    diagnostics.push({
      severity: 'warning',
      message: `OccluderInstance3D '${node.name}' has a Bake Mask with no bits enabled, so baking will not produce any occluder mesh for it. Enable at least one bit in the Bake Mask property.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'occluderinstance3d-empty-bake-mask',
    });
  }

  // occluder_instance_3d.cpp:704-705. A node with no Occluder is valid, since a script
  // may assign one or the node is a bake target, but it culls nothing until then.
  if (resourceSlotIsEmpty(rawProps.occluder)) {
    diagnostics.push({
      severity: 'warning',
      message: `OccluderInstance3D '${node.name}' has no 'occluder', so it performs no occlusion culling until one is assigned.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'occluderinstance3d-missing-occluder',
    });
  }

  return diagnostics;
}

const occluderInstance3DConfigurationWarningsRule: LintRule = {
  meta: {
    name: 'valid-occluderinstance3d-configuration',
    description:
      "Ports OccluderInstance3D's own get_configuration_warnings: an empty Bake Mask or a missing Occluder resource",
    category: 'validation',
    applicableNodeTypes: ['OccluderInstance3D'],
    emits: [
      { ruleName: 'occluderinstance3d-empty-bake-mask', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'occluderinstance3d-missing-occluder', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkOccluderInstance3D,
};

ruleRegistry.register(occluderInstance3DConfigurationWarningsRule);

export { occluderInstance3DConfigurationWarningsRule };
