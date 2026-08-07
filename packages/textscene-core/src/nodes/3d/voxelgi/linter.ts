/**
 * Semantic linter rule for VoxelGI, from Godot's own
 * `VoxelGI::get_configuration_warnings()` (voxel_gi.cpp:538-550):
 *
 *     PackedStringArray warnings = VisualInstance3D::get_configuration_warnings();
 *     if (OS::get_singleton()->get_current_rendering_method() == "gl_compatibility") {
 *         warnings.push_back(RTR("VoxelGI nodes are not supported when using the Compatibility renderer yet. ..."));
 *     } else if (OS::get_singleton()->get_current_rendering_method() == "dummy") {
 *         warnings.push_back(RTR("VoxelGI nodes are not supported when using the Dummy renderer."));
 *     } else if (probe_data.is_null()) {
 *         warnings.push_back(RTR("No VoxelGI data set, so this node is disabled. Bake static objects to enable GI."));
 *     }
 *     return warnings;
 *
 * The first two branches read `OS::get_current_rendering_method()`, runtime
 * state no `.tscn` carries — not modelled. The third is the property's own
 * ADD_PROPERTY name, `data` (voxel_gi.cpp:573), not the C++ member
 * `probe_data`, and is checkable directly: absence IS the trigger, the same
 * shape as `decal-requires-texture` and `gpuparticles3d-missing-process-material`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';

const MISSING_DATA_RULE = 'voxelgi-missing-data';

function checkVoxelGI(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = node.properties as unknown as Record<string, string>;

  if (properties.data) return [];

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
    emits: [{ ruleName: MISSING_DATA_RULE, severity: 'warning' }],
  },
  check: checkVoxelGI,
};

ruleRegistry.register(voxelGIValidationRule);

export { voxelGIValidationRule };
