/**
 * Semantic linter rule for OpenXRRenderModel, from Godot's own configuration
 * warnings, `OpenXRRenderModel::get_configuration_warnings()`
 * (openxr_render_model.cpp:146-159):
 *
 *     Node *parent = get_parent();
 *     if (!parent->is_class("XROrigin3D") && !parent->is_class("OpenXRRenderModelManager")) {
 *         warnings.push_back("This node must be a child of either a XROrigin3D or OpenXRRenderModelManager node!");
 *     }
 *
 *     if (!GLOBAL_GET("xr/openxr/extensions/render_model")) {
 *         warnings.push_back("The render model extension is not enabled in project settings!");
 *     }
 *
 * Only the first warning is modelled here. The second reads a PROJECT SETTING
 * (`xr/openxr/extensions/render_model`) that no `.tscn` carries — runtime-only,
 * declined.
 *
 * Godot's own C++ dereferences `get_parent()` unconditionally
 * (`parent->is_class(...)`), so a scene-root OpenXRRenderModel would crash the
 * engine's own check rather than emit a clean warning. This rule does not
 * reproduce that crash; it treats "no parent" the same as "a parent that is
 * neither accepted type", matching how OpenXRVisibilityMask and
 * BoneAttachment3D (both cited in `parentType.ts`'s docblock) warn at the
 * scene root for their own parent checks.
 *
 * The two accepted parent types are combined by calling `parentTypeVerdict`
 * once per type rather than hand-rolling the instanced/untyped exemption a
 * second time: since both calls resolve the SAME physical parent, at most one
 * of them can come back `satisfied` (a node cannot descend from two unrelated
 * classes), and `unknowable` for either arm means the same untyped/instanced
 * parent might be the other accepted type — not something to warn about.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { parentTypeVerdict, placementPhrase } from '../../../../linter/parentType.js';

const PARENT_RULE = 'openxrrendermodel-parent-not-origin-or-manager';

function checkOpenXRRenderModelParent(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;

  const originVerdict = parentTypeVerdict(scene, node, 'XROrigin3D');
  if (originVerdict.kind === 'satisfied') return [];
  const managerVerdict = parentTypeVerdict(scene, node, 'OpenXRRenderModelManager');
  if (managerVerdict.kind === 'satisfied') return [];
  if (originVerdict.kind === 'unknowable') return [];

  const where = placementPhrase(originVerdict);
  return [
    {
      severity: 'warning',
      message: `OpenXRRenderModel '${node.name}' is ${where}. Godot expects it to be a child of either an XROrigin3D or an OpenXRRenderModelManager node.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: PARENT_RULE,
    },
  ];
}

const openXRRenderModelParentRule: LintRule = {
  meta: {
    name: 'valid-openxrrendermodel-parent',
    description:
      "Warns when an OpenXRRenderModel's parent is neither an XROrigin3D nor an OpenXRRenderModelManager, Godot's own configuration warning for this node",
    category: 'validation',
    applicableNodeTypes: ['OpenXRRenderModel'],
    emits: [{ ruleName: PARENT_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkOpenXRRenderModelParent,
};

ruleRegistry.register(openXRRenderModelParentRule);

export { openXRRenderModelParentRule };
