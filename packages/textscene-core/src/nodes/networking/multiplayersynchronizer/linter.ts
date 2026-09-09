/**
 * Semantic linter rule for MultiplayerSynchronizer, from Godot's own
 * configuration warning (multiplayer_synchronizer.cpp:146-154):
 *
 *     if (root_path.is_empty() || !has_node(root_path)) {
 *         warnings.push_back(RTR("A valid NodePath must be set in the \"Root
 *         Path\" property in order for MultiplayerSynchronizer to be able to
 *         synchronize properties."));
 *     }
 *
 * Unlike MultiplayerSpawner's `spawn_path`, `root_path` does NOT default to
 * empty: doc/classes/MultiplayerSynchronizer.xml gives it
 * `default="NodePath(&quot;..&quot;)"`. An absent key is that default, and
 * `..` almost always resolves (it names this node's own parent, which every
 * non-root node in a `.tscn` has) — so the `is_empty()` disjunct is
 * unreachable from mere absence, for a different reason than the spawner's:
 * there the trigger IS the default; here the default is not the trigger.
 * `..` itself resolves: `resolveNodePath` climbs to the parent the way
 * `get_node_or_null` does, and only a `..` off the file's own root has no
 * answer. So a bare default or explicit `NodePath("..")` is silent because it
 * names a real node or an `unknowable` one — never `missing` — not by inventing a
 * second resolution mechanism for the single-hop case, since the shared
 * helper's own contract already covers it.
 *
 * The `!has_node(root_path)` disjunct is checkable when `root_path` is
 * PRESENT and names a plain (non-`..`) path with no match in this file: a
 * real dangling reference, resolved the same way MeshInstance3D's `skeleton`
 * NodePath is.
 *
 * `warning`, not the `error` the dangling-skeleton rule uses. Godot raises this
 * as a configuration warning, and ADR-0032 reserves `error` for a setter that
 * refuses or alters a value — the scene loads and every property here is
 * well-formed.
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
