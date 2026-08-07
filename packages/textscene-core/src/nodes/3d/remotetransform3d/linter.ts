/**
 * Semantic linter rule for RemoteTransform3D, from Godot's own
 * `RemoteTransform3D::get_configuration_warnings()` (remote_transform_3d.cpp:206-211):
 *
 *     PackedStringArray warnings = Node3D::get_configuration_warnings();
 *     if (!has_node(remote_node) || !Object::cast_to<Node3D>(get_node(remote_node))) {
 *         warnings.push_back(RTR("The \"Remote Path\" property must point to a valid Node3D or Node3D-derived node to work."));
 *     }
 *     return warnings;
 *
 * `remote_node` (serialised key `remote_path`) field-initialises to `NodePath()`
 * (remote_transform_3d.h:38, no constructor override), which IS the trigger —
 * unlike `MultiplayerSpawner`, this single Godot condition was not split into a
 * default-omitted half and a dangling half, so the honest implementation covers
 * all three of "absent", "present but resolves to nothing in this file", and
 * "present and resolves, but not to a Node3D".
 *
 * `resolveNodePathTarget` stays silent on `escapes`/`ambiguous` (a `..` segment
 * or an instanced ancestor puts the real target outside what this linter can
 * see, and Godot allows node names to repeat across parents) — same caution
 * every other NodePath-target rule in this repo applies.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';
import { extractNodePath, resolveNodePathTarget } from '../../../linter/linterUtils.js';

const RULE_NAME = 'remotetransform3d-invalid-remote-path';

function checkRemoteTransform3D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;

  const path = properties.remote_path ? extractNodePath(properties.remote_path) : null;

  // Absent key, or an explicit empty NodePath("") — both are `NodePath()`,
  // Godot's own default and the trigger itself.
  if (!path) {
    return [
      {
        severity: 'warning',
        message: `RemoteTransform3D '${node.name}' has no Remote Path set. The Remote Path property must point to a valid Node3D or Node3D-derived node to work.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: RULE_NAME,
      },
    ];
  }

  const target = resolveNodePathTarget(scene.nodes, node, path);

  if (target.status === 'missing') {
    return [
      {
        severity: 'warning',
        message: `RemoteTransform3D '${node.name}' has remote_path set to NodePath("${path}"), which names no node in this file. The Remote Path property must point to a valid Node3D or Node3D-derived node to work.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: RULE_NAME,
      },
    ];
  }

  if (target.status === 'found' && target.node.type !== 'Node3D' && !descendsFrom(target.node.type, 'Node3D')) {
    return [
      {
        severity: 'warning',
        message: `RemoteTransform3D '${node.name}' has remote_path pointing to a ${target.node.type} node, but the Remote Path property must point to a valid Node3D or Node3D-derived node to work.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: RULE_NAME,
      },
    ];
  }

  return [];
}

const remoteTransform3DValidationRule: LintRule = {
  meta: {
    name: 'valid-remotetransform3d-remote-path',
    description:
      "Mirrors RemoteTransform3D::get_configuration_warnings' remote_path check: absent, dangling, or not a Node3D",
    category: 'validation',
    applicableNodeTypes: ['RemoteTransform3D'],
    emits: [{ ruleName: RULE_NAME, severity: 'warning' }],
  },
  check: checkRemoteTransform3D,
};

ruleRegistry.register(remoteTransform3DValidationRule);

export { remoteTransform3DValidationRule };
