/**
 * Semantic linter rule for OccluderInstance3D: ports two of the four
 * conditions from `OccluderInstance3D::get_configuration_warnings()`
 * (occluder_instance_3d.cpp:693-720):
 *
 *     if (bake_mask == 0) {
 *         warnings.push_back(RTR("The Bake Mask has no bits enabled, which
 *         means baking will not produce any occluder meshes for this
 *         OccluderInstance3D. ..."));
 *     }
 *     if (occluder.is_null()) {
 *         warnings.push_back(RTR("No occluder mesh is defined in the Occluder
 *         property, so no occlusion culling will be performed using this
 *         OccluderInstance3D. ..."));
 *     }
 *
 * Both are decidable from the node's own property bag: `bake_mask` is a plain
 * int, and `occluder` absence is a key-presence check — same pattern as
 * GPUParticlesCollisionSDF3D's bake-mask rule and AudioStreamPlayer3D's
 * missing-stream advisory ("absence is Godot's default form": a missing
 * optional resource is a WARNING, never an error).
 *
 * The other two conditions in the same function are deliberately NOT ported:
 *
 * - The `rendering/occlusion_culling/use_occlusion_culling` ProjectSettings
 *   check needs `project.godot`, which no `.tscn`-scoped rule here reads.
 * - `ArrayOccluder3D`/`PolygonOccluder3D` vertex-count warnings need the
 *   REFERENCED occluder resource's own internals (`indices`/`polygon`
 *   arrays). Godot-authored occluders are normally baked to an external
 *   `.occ`/`.tres` file reached via `ExtResource`, whose body this repo never
 *   reads, so the check is structurally blind in the common case; and unlike
 *   `Path3D`'s `Curve3D._data` check (which exists because a malformed curve
 *   makes the scene render EMPTY here while it renders fine in Godot), an
 *   under-vertexed occluder changes nothing in either render — occlusion
 *   culling is a performance-only effect this previewer never simulates.
 */

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

  // occluder_instance_3d.cpp:700-702. Godot's serialiser omits a property left
  // at its default (4294967295, all layers), so only an EXPLICIT `bake_mask = 0`
  // fires this.
  if (rawProps.bake_mask !== undefined && ruleInt(rawProps.bake_mask) === 0) {
    diagnostics.push({
      severity: 'warning',
      message: `OccluderInstance3D '${node.name}' has a Bake Mask with no bits enabled, so baking will not produce any occluder mesh for it. Enable at least one bit in the Bake Mask property.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'occluderinstance3d-empty-bake-mask',
    });
  }

  // occluder_instance_3d.cpp:704-705. Advisory, not an error: an
  // OccluderInstance3D with no Occluder resource is valid Godot (a script may
  // assign one at runtime, or the node exists purely as a bake target), it
  // simply performs no occlusion culling until one is set.
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
