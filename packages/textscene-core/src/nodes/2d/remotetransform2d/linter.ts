/**
 * Semantic linter rule for RemoteTransform2D, from Godot's own configuration
 * warning, `RemoteTransform2D::get_configuration_warnings()`
 * (remote_transform_2d.cpp:213-220):
 *
 *     if (!has_node(remote_node) || !Object::cast_to<Node2D>(get_node(remote_node))) {
 *         warnings.push_back(RTR("Path property must point to a valid Node2D node to work."));
 *     }
 *
 * One push covering three distinct authoring states, all reported under the
 * same warning because the engine's own text does not distinguish them:
 * `remote_path` absent (defaults to `NodePath()`, and `has_node()` on an empty
 * path is false, so absence IS the trigger — unlike the properties this repo
 * declines as `default-omitted`, this one is genuinely useful to flag, the
 * same call CollisionShape2D's `shape` already makes); present but naming no
 * node in this file (`!has_node`); present and resolving, but to something
 * that is not a Node2D (`!cast_to<Node2D>`, subclasses included).
 *
 * `resolveNodePathTarget` stays quiet on a relative (`..`) or ambiguous path,
 * same as the MultiplayerSpawner/MultiplayerSynchronizer dangling-path rules —
 * a confident answer needs the path to name exactly one node in this file.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { extractNodePath, isValidProperties, resolveNodePathTarget } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';

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

  const target = resolveNodePathTarget(scene.nodes, node, path);
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
