/**
 * Semantic linter rule for BoneAttachment3D, from Godot's own configuration
 * warnings, `BoneAttachment3D::get_configuration_warnings()`
 * (bone_attachment_3d.cpp:63-72):
 *
 *     if (use_external_skeleton) {
 *         if (external_skeleton_node_cache.is_null()) {
 *             warnings.push_back(RTR("External Skeleton3D node not set! ..."));
 *         }
 *     } else {
 *         Skeleton3D *parent = Object::cast_to<Skeleton3D>(get_parent());
 *         if (!parent) {
 *             warnings.push_back(RTR("Parent node is not a Skeleton3D node! ..."));
 *         }
 *     }
 *
 * The two arms are the two ways `get_skeleton()` (cpp:128-142) can find a
 * skeleton, and they are exclusive: with the flag off it returns
 * `cast_to<Skeleton3D>(get_parent())` and never looks at `external_skeleton`;
 * with it on it resolves the path and never looks at the parent. A
 * BoneAttachment3D that resolves neither relays no bone transform at all, which
 * is its entire job, so the whole node is inert. Advisory, hence a warning: the
 * scene loads and every property is well-formed.
 *
 * Two states this deliberately stays quiet about:
 *
 * - A parent whose type the linter cannot know (a heading with `instance=` and
 *   no `type=`) takes its type from a scene the linter never opens.
 * - The flag on with an EMPTY path under a parent BoneAttachment3D:
 *   `_update_external_skeleton_cache` (cpp:93-108) then inherits the parent's
 *   external skeleton, so an empty path there is a real authoring state.
 *
 * `bone_idx == -1` (cpp:74-76) is Godot's third configuration warning and gets
 * no rule: -1 is the property's serialised default, so the file Godot writes
 * for an unbound attachment carries no `bone_idx` line at all, and flagging its
 * absence would demand a key the engine omits.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { extractNodePath } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { parentTypeVerdict, placementPhrase } from '../../../../linter/parentType.js';

const PARENT_RULE = 'boneattachment3d-parent-not-skeleton3d';
const EXTERNAL_RULE = 'boneattachment3d-external-skeleton-unset';

function checkBoneAttachment3D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;
  if (properties.use_external_skeleton === 'true') {
    // `extractNodePath` returns null for a non-literal and for NodePath(""),
    // which is exactly the "no path" case the engine's null cache covers.
    if (extractNodePath(properties.external_skeleton ?? '') !== null) return [];
    // An unknowable parent may well BE the BoneAttachment3D this one would
    // inherit a skeleton from, so it is not something to warn about.
    const inherited = parentTypeVerdict(scene, node, 'BoneAttachment3D');
    if (inherited.kind === 'satisfied' || inherited.kind === 'unknowable') return [];

    return [
      {
        severity: 'warning',
        message: `BoneAttachment3D '${node.name}' has use_external_skeleton on but no external_skeleton path, so it resolves no skeleton and relays no bone transform. Set external_skeleton, or turn the flag off and parent it to a Skeleton3D.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: EXTERNAL_RULE,
      },
    ];
  }

  const attached = parentTypeVerdict(scene, node, 'Skeleton3D');
  if (attached.kind === 'satisfied' || attached.kind === 'unknowable') return [];

  const where = placementPhrase(attached);
  return [
    {
      severity: 'warning',
      message: `BoneAttachment3D '${node.name}' is ${where}. Without use_external_skeleton it attaches to its direct parent only, so it resolves no skeleton and relays no bone transform.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: PARENT_RULE,
    },
  ];
}

const boneAttachment3DSkeletonRule: LintRule = {
  meta: {
    name: 'valid-boneattachment3d-skeleton',
    description:
      'Warns when a BoneAttachment3D can resolve no Skeleton3D (neither a Skeleton3D parent nor an external_skeleton path) and so relays nothing',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'BoneAttachment3D'),
    emits: [
      { ruleName: PARENT_RULE, severity: 'warning' },
      { ruleName: EXTERNAL_RULE, severity: 'warning' },
    ],
  },
  check: checkBoneAttachment3D,
};

ruleRegistry.register(boneAttachment3DSkeletonRule);

export { boneAttachment3DSkeletonRule };
