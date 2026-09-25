/**
 * VoxelGI rule from `VoxelGI::get_configuration_warnings()` (voxel_gi.cpp:538-550). Its first two
 * branches read `OS::get_current_rendering_method()`, runtime state no `.tscn` carries. The third
 * fires on a null `probe_data`, serialised as `data` (voxel_gi.cpp:573), so absence is the trigger.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';

const MISSING_DATA_RULE = 'voxelgi-missing-data';

function checkVoxelGI(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = node.properties as unknown as Record<string, string>;

  if (!resourceSlotIsEmpty(properties.data)) return [];

  return [
    {
      severity: 'warning',
      message: `VoxelGI '${node.name}' has no data set, so this node is disabled. Bake static objects to enable GI.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: MISSING_DATA_RULE,
    },
  ];
}

const voxelGIValidationRule: LintRule = {
  meta: {
    name: 'valid-voxelgi-data',
    description: "Mirrors VoxelGI::get_configuration_warnings' missing-data check",
    category: 'validation',
    applicableNodeTypes: ['VoxelGI'],
    emits: [{ ruleName: MISSING_DATA_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkVoxelGI,
};

ruleRegistry.register(voxelGIValidationRule);

export { voxelGIValidationRule };
