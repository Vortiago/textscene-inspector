/**
 * RemoteTransform3D's `get_configuration_warnings()` (remote_transform_3d.cpp:206-211): it warns
 * unless `remote_node` (key `remote_path`) resolves to a Node3D. `remote_node` defaults to
 * `NodePath()` (remote_transform_3d.h:38, no constructor override), which triggers it, so the rule
 * covers an absent path, a path to nothing in this file and a path to a node that is no Node3D.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { extractNodePath } from '../../../linter/linterUtils.js';
import { resolveNodePath } from '../../../linter/nodePathResolve.js';
import { armDiagnostic, armEmits, type RuleArms } from '../../../linter/ruleArms.js';

const arms = {
  invalidRemotePath: {
    severity: 'warning',
    ruleName: 'remotetransform3d-invalid-remote-path',
    grounding: { kind: 'configuration-warning' },
  },
} as const satisfies RuleArms<string>;

function checkRemoteTransform3D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;

  const path = properties.remote_path ? extractNodePath(properties.remote_path) : null;

  // Absent key, or an explicit empty NodePath(""): both are `NodePath()`, the default and the trigger.
  if (!path) {
    return [
      armDiagnostic(
        arms.invalidRemotePath,
        node,
        `RemoteTransform3D '${node.name}' has no Remote Path set. The Remote Path property must point to a valid Node3D or Node3D-derived node to work.`
      ),
    ];
  }

  // Silent only on `unknowable`: an instanced ancestor, an instanced target or a walk into content
  // another file declares. A `..` segment climbs, as `get_node_or_null` does.
  const target = resolveNodePath(scene, node, path);

  if (target.status === 'missing') {
    return [
      armDiagnostic(
        arms.invalidRemotePath,
        node,
        `RemoteTransform3D '${node.name}' has remote_path set to NodePath("${path}"), which names no node in this file. The Remote Path property must point to a valid Node3D or Node3D-derived node to work.`
      ),
    ];
  }

  // `descendsFrom` is reflexive (nodeBaseTypes.ts), so it also answers the exact-match case.
  if (target.status === 'found' && !descendsFrom(target.node.type, 'Node3D')) {
    return [
      armDiagnostic(
        arms.invalidRemotePath,
        node,
        `RemoteTransform3D '${node.name}' has remote_path pointing to a ${target.node.type} node, but the Remote Path property must point to a valid Node3D or Node3D-derived node to work.`
      ),
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
    emits: armEmits(arms),
  },
  check: checkRemoteTransform3D,
};

ruleRegistry.register(remoteTransform3DValidationRule);

export { remoteTransform3DValidationRule };
