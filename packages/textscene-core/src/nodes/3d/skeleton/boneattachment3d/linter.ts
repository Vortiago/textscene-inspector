/**
 * BoneAttachment3D's configuration warnings (bone_attachment_3d.cpp:63-72), the two exclusive ways
 * `get_skeleton()` (cpp:128-142) finds a skeleton: with `use_external_skeleton` on, an unset external
 * cache warns, and with it off, a parent that is not a Skeleton3D warns. A node that resolves neither
 * relays no bone transform, but the scene loads and every property is well-formed, so both warn.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { extractNodePath } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { parentTypeVerdict, placementPhrase } from '../../../../linter/parentType.js';
import { resolveNodePath } from '../../../../linter/nodePathResolve.js';
import { boolSlotValue } from '../../../../godot/index.js';

const PARENT_RULE = 'boneattachment3d-parent-not-skeleton3d';
const EXTERNAL_RULE = 'boneattachment3d-external-skeleton-unset';

// `bone_idx == -1` (cpp:74-76) is Godot's third warning and gets no rule: -1 is the serialised
// default, so an unbound attachment's file carries no `bone_idx` line to flag.

function checkBoneAttachment3D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;
  if (boolSlotValue(properties.use_external_skeleton) === true) {
    // `extractNodePath` returns null for a non-literal and for NodePath(""),
    // which is exactly the "no path" case the engine's null cache covers.
    const path = extractNodePath(properties.external_skeleton ?? '');
    if (path !== null) {
      // A present path does not set the cache. `_update_external_skeleton_cache` (cpp:81-92) fills
      // it only when `has_node(external_skeleton_node)` holds and the node casts to Skeleton3D, and
      // its `ERR_FAIL_NULL_MSG(sk, …)` returns with the cache null otherwise. Either miss leaves
      // `external_skeleton_node_cache.is_null()` true at cpp:64, so Godot warns.
      const target = resolveNodePath(scene, node, path);
      if (target.status === 'unknowable') return [];
      if (target.status === 'found' && descendsFrom(target.node.type, 'Skeleton3D')) return [];

      const because =
        target.status === 'missing'
          ? 'names no node reachable from this one'
          : `points at a ${target.node.type}, not a Skeleton3D`;
      return [
        {
          severity: 'warning',
          message: `BoneAttachment3D '${node.name}' has use_external_skeleton on, but external_skeleton NodePath("${path}") ${because}, so the skeleton cache stays empty and it relays no bone transform.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: EXTERNAL_RULE,
        },
      ];
    }
    // An empty path inherits a parent BoneAttachment3D's external skeleton
    // (`_update_external_skeleton_cache`, cpp:93-108). An unknowable parent may be that
    // BoneAttachment3D, so it does not warn either.
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

  // A parent with `instance=` and no `type=` takes its type from a scene the linter never opens.
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
      { ruleName: PARENT_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: EXTERNAL_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkBoneAttachment3D,
};

ruleRegistry.register(boneAttachment3DSkeletonRule);

export { boneAttachment3DSkeletonRule };
