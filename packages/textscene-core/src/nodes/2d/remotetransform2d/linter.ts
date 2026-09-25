/**
 * Ports `RemoteTransform2D::get_configuration_warnings()` (remote_transform_2d.cpp:213-220):
 * one warning for `remote_path` absent, naming no node, or naming a non-Node2D.
 * An absent path is the empty `NodePath()`, and `has_node()` on it is false, so
 * absence is the trigger. `resolveNodePath` declines only a walk into another file.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { extractNodePath, isValidProperties } from '../../../linter/linterUtils.js';
import { resolveNodePath } from '../../../linter/nodePathResolve.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';

const RULE_NAME = 'remotetransform2d-invalid-remote-path';

function warn(node: RuleContext['node'], detail: string): Diagnostic[] {
  return [
    {
      severity: 'warning',
      message: `RemoteTransform2D '${node.name}' ${detail} Path property must point to a valid Node2D node to work.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE_NAME,
    },
  ];
}

function checkRemoteTransform2D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  if (!isValidProperties(node.properties)) return [];

  const raw = node.properties.remote_path;
  const path = raw !== undefined ? extractNodePath(raw) : null;
  if (path === null) {
    return warn(node, 'has no remote_path set.');
  }

  const target = resolveNodePath(scene, node, path);
  if (target.status === 'missing') {
    return warn(node, `has remote_path set to NodePath("${path}"), which names no node in this file.`);
  }
  if (target.status === 'found' && target.node.type && !descendsFrom(target.node.type, 'Node2D')) {
    return warn(
      node,
      `has remote_path pointing to '${target.node.name}', a ${target.node.type}, which is not a Node2D.`
    );
  }

  return [];
}

const remoteTransform2DPathRule: LintRule = {
  meta: {
    name: 'valid-remotetransform2d-remote-path',
    description:
      'Warns when RemoteTransform2D has no remote_path, or remote_path resolves to no node or a non-Node2D node',
    category: 'validation',
    applicableNodeTypes: ['RemoteTransform2D'],
    emits: [{ ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkRemoteTransform2D,
};

ruleRegistry.register(remoteTransform2DPathRule);

export { remoteTransform2DPathRule };
