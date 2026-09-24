/**
 * Semantic linter rule for MultiplayerSpawner, from Godot's configuration warning on
 * `spawn_path.is_empty() || !has_node(spawn_path)` (multiplayer_spawner.cpp:88-95). An absent key
 * is Godot's default `NodePath("")` (multiplayer_spawner.cpp:58), so only a present, non-empty path
 * that names no node in this file warns. A warning, not an error: the scene loads (ADR-0032).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { extractNodePath, isValidProperties } from '../../../linter/linterUtils.js';
import { resolveNodePath } from '../../../linter/nodePathResolve.js';

const RULE_NAME = 'multiplayerspawner-spawn-path-dangling';

function checkMultiplayerSpawner(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  if (!isValidProperties(node.properties)) return [];

  const raw = node.properties.spawn_path;
  if (!raw) return [];

  const path = extractNodePath(raw);
  if (!path) return [];

  const target = resolveNodePath(scene, node, path);
  if (target.status !== 'missing') return [];

  return [
    {
      severity: 'warning',
      message: `MultiplayerSpawner '${node.name}' has spawn_path set to NodePath("${path}"), which names no node in this file. A valid Spawn Path is required for MultiplayerSpawner to spawn nodes.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE_NAME,
    },
  ];
}

const multiplayerSpawnerSpawnPathRule: LintRule = {
  meta: {
    name: 'valid-multiplayerspawner-spawn-path',
    description:
      "Warns when MultiplayerSpawner's spawn_path names no node in this file, mirroring Godot's own configuration warning",
    category: 'validation',
    applicableNodeTypes: ['MultiplayerSpawner'],
    emits: [{ ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkMultiplayerSpawner,
};

ruleRegistry.register(multiplayerSpawnerSpawnPathRule);

export { multiplayerSpawnerSpawnPathRule };
