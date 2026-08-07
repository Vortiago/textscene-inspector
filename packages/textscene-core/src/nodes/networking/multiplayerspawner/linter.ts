/**
 * Semantic linter rule for MultiplayerSpawner, from Godot's own configuration
 * warning (multiplayer_spawner.cpp:88-95):
 *
 *     if (spawn_path.is_empty() || !has_node(spawn_path)) {
 *         warnings.push_back(RTR("A valid NodePath must be set in the \"Spawn
 *         Path\" property in order for MultiplayerSpawner to be able to spawn
 *         Nodes."));
 *     }
 *
 * `spawn_path` defaults to `NodePath("")` (multiplayer_spawner.cpp:58 XML
 * `default="NodePath(&quot;&quot;)"`), which is exactly the value the
 * `is_empty()` disjunct fires on — an absent key IS Godot's own default, so
 * flagging its absence would demand a key the serialiser omits
 * (default-omitted, per the repo's "absence is Godot's default form" rule).
 *
 * The `!has_node(spawn_path)` disjunct is a different, checkable condition: a
 * PRESENT, non-empty `spawn_path` that names no node in this file is a real
 * dangling reference, resolved the same way MeshInstance3D's `skeleton`
 * NodePath is. `extractNodePath` already returns null for `NodePath("")`, so
 * an explicit empty override falls out of this check for free too.
 *
 * Forced to `warning` severity (not `error`, unlike the dangling-skeleton
 * rule) per this task's brief.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { extractNodePath, resolveNodePathTarget, isValidProperties } from '../../../linter/linterUtils.js';

const RULE_NAME = 'multiplayerspawner-spawn-path-dangling';

function checkMultiplayerSpawner(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  if (!isValidProperties(node.properties)) return [];

  const raw = node.properties.spawn_path;
  if (!raw) return [];

  const path = extractNodePath(raw);
  if (!path) return [];

  const target = resolveNodePathTarget(scene.nodes, node, path);
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
    emits: [{ ruleName: RULE_NAME, severity: 'warning' }],
  },
  check: checkMultiplayerSpawner,
};

ruleRegistry.register(multiplayerSpawnerSpawnPathRule);

export { multiplayerSpawnerSpawnPathRule };
