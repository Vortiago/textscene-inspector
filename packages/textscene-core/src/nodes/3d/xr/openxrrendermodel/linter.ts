/**
 * The parent warning of `OpenXRRenderModel::get_configuration_warnings()`
 * (openxr_render_model.cpp:146-159): the parent must be an XROrigin3D or an OpenXRRenderModelManager.
 * The second warning reads the project setting `xr/openxr/extensions/render_model`, which no `.tscn`
 * carries, so it is not modelled.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { parentTypeVerdict, placementPhrase } from '../../../../linter/parentType.js';
import { armDiagnostic, armEmits, groundedArm, type RuleArms } from '../../../../linter/ruleArms.js';

const arms = {
  parentNotOriginOrManager: groundedArm('openxrrendermodel-parent-not-origin-or-manager', { kind: 'configuration-warning' }),
} as const satisfies RuleArms<string>;

// Godot dereferences `get_parent()` with no guard, so a scene-root node crashes its check. This rule
// warns at the root instead, as OpenXRVisibilityMask and BoneAttachment3D do.
function checkOpenXRRenderModelParent(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;

  // One `parentTypeVerdict` per accepted type, not a second copy of its exemption: at most one arm is
  // `satisfied` for the one parent, and an `unknowable` parent might be the other accepted type.
  const originVerdict = parentTypeVerdict(scene, node, 'XROrigin3D');
  if (originVerdict.kind === 'satisfied') return [];
  const managerVerdict = parentTypeVerdict(scene, node, 'OpenXRRenderModelManager');
  if (managerVerdict.kind === 'satisfied') return [];
  if (originVerdict.kind === 'unknowable') return [];

  const where = placementPhrase(originVerdict);
  return [
    armDiagnostic(
      arms.parentNotOriginOrManager,
      node,
      `OpenXRRenderModel '${node.name}' is ${where}. Godot expects it to be a child of either an XROrigin3D or an OpenXRRenderModelManager node.`
    ),
  ];
}

const openXRRenderModelParentRule: LintRule = {
  meta: {
    name: 'valid-openxrrendermodel-parent',
    description:
      "Warns when an OpenXRRenderModel's parent is neither an XROrigin3D nor an OpenXRRenderModelManager, Godot's own configuration warning for this node",
    category: 'validation',
    applicableNodeTypes: ['OpenXRRenderModel'],
    emits: armEmits(arms),
  },
  check: checkOpenXRRenderModelParent,
};

ruleRegistry.register(openXRRenderModelParentRule);

export { openXRRenderModelParentRule };
