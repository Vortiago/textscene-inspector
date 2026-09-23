/**
 * Semantic linter rule for MultiplayerSynchronizer, from Godot's configuration warning on
 * `root_path.is_empty() || !has_node(root_path)` (multiplayer_synchronizer.cpp:146-154). The default
 * `NodePath("..")` (doc/classes/MultiplayerSynchronizer.xml) resolves or is `unknowable`, never
 * `missing`, so only a present path naming no node warns. Not an error: the scene loads (ADR-0032).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { extractNodePath, isValidProperties } from '../../../linter/linterUtils.js';
import { resolveNodePath } from '../../../linter/nodePathResolve.js';

const RULE_NAME = 'multiplayersynchronizer-root-path-dangling';

function checkMultiplayerSynchronizer(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  if (!isValidProperties(node.properties)) return [];

  const raw = node.properties.root_path;
  if (!raw) return [];

  const path = extractNodePath(raw);
  if (!path) return [];

  const target = resolveNodePath(scene, node, path);
  if (target.status !== 'missing') return [];

  return [
    {
      severity: 'warning',
      message: `MultiplayerSynchronizer '${node.name}' has root_path set to NodePath("${path}"), which names no node in this file. A valid Root Path is required for MultiplayerSynchronizer to synchronize properties.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE_NAME,
    },
  ];
}

const multiplayerSynchronizerRootPathRule: LintRule = {
  meta: {
    name: 'valid-multiplayersynchronizer-root-path',
    description:
      "Warns when MultiplayerSynchronizer's root_path names no node in this file, mirroring Godot's own configuration warning",
    category: 'validation',
    applicableNodeTypes: ['MultiplayerSynchronizer'],
    emits: [{ ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkMultiplayerSynchronizer,
};

ruleRegistry.register(multiplayerSynchronizerRootPathRule);

export { multiplayerSynchronizerRootPathRule };
