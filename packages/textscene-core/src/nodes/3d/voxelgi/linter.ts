/**
 * VoxelGI rule from `VoxelGI::get_configuration_warnings()` (voxel_gi.cpp:538-550). Its first two
 * branches read `OS::get_current_rendering_method()`, runtime state no `.tscn` carries. The third
 * fires on a null `probe_data`, serialised as `data` (voxel_gi.cpp:573), so absence is the trigger.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';
import { armDiagnostic, armEmits, groundedArm, type RuleArms } from '../../../linter/ruleArms.js';

const arms = {
  missingData: groundedArm('voxelgi-missing-data', { kind: 'configuration-warning' }),
} as const satisfies RuleArms<string>;

function checkVoxelGI(context: RuleContext): Diagnostic[] {
  const { node } = context;

  if (!resourceSlotIsEmpty(node.rawProperties.data)) return [];

  return [
    armDiagnostic(
      arms.missingData,
      node,
      `VoxelGI '${node.name}' has no data set, so this node is disabled. Bake static objects to enable GI.`
    ),
  ];
}

const voxelGIValidationRule: LintRule = {
  meta: {
    name: 'valid-voxelgi-data',
    description: "Mirrors VoxelGI::get_configuration_warnings' missing-data check",
    category: 'validation',
    applicableNodeTypes: ['VoxelGI'],
    emits: armEmits(arms),
  },
  check: checkVoxelGI,
};

ruleRegistry.register(voxelGIValidationRule);

export { voxelGIValidationRule };
