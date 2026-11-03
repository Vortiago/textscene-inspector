/**
 * The relay cycle check of RemoteTransform3D and RemoteTransform2D. A push moves the target, which
 * queues every relay in global coordinates that the move reaches, and that relay pushes on the next
 * transform flush (`remote_transform_3d.cpp:118-126`, `remote_transform_2d.cpp:127-136`). A relay
 * cycle so pushes on every frame without end, and no one frame's pose is the game's pose.
 */

import type { RawNode, RawScene } from '../../../parser/types.js';
import type { Diagnostic, RuleArm, RuleContext } from '../../../linter/types.js';
import { armDiagnostic } from '../../../linter/ruleArms.js';
import { extractNodePath, nodesOfType } from '../../../linter/linterUtils.js';
import { parentIdentity } from '../../../linter/parentType.js';
import { resolveNodePath } from '../../../linter/nodePathResolve.js';
import { parseOptionalBool } from '../../../parser/valueParsers.js';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { perObject } from '../../../utils/perObject.js';
import { RELAY_CLASSES, flagsAnyPart, readFlags, type RemoteFlags } from './relayRules.js';

/** The arm that warns on a relay in a cycle, grounded on the push `pushAt` names (`file.cpp:line`). */
export function relayCycleArm(ruleName: string, pushAt: string): RuleArm {
  return { severity: 'warning', ruleName, grounding: { kind: 'engine', at: pushAt } };
}

/** A warning under `arm` when the relay of `context` is in a relay cycle. */
export function relayCycleDiagnostics(arm: RuleArm, { node, scene }: RuleContext): Diagnostic[] {
  if (!relaysInACycle(scene).has(node)) return [];
  return [
    armDiagnostic(
      arm,
      node,
      `${node.type} '${node.name}' is in a relay cycle: its target carries a relay that leads back to it. ` +
        'Godot pushes these relays again on every frame without end, so their pose depends on the frame count.'
    ),
  ];
}

/**
 * The relays of `scene` on a cycle that holds a relay in global coordinates. A cycle of local relays
 * alone pushes only when something else moves one of them, which no push does when the scene loads.
 */
const relaysInACycle = perObject((scene: RawScene): ReadonlySet<RawNode> => {
  const relays = Object.keys(RELAY_CLASSES).flatMap((type) => nodesOfType(scene.nodes, type));
  const queuedBy = new Map(relays.map((relay) => [relay, relaysAPushOfMoves(relay, scene)]));
  const reachedFrom = perObject((relay: RawNode) => relaysReached(relay, queuedBy));
  const isGlobal = (relay: RawNode): boolean => flagsOf(relay).useGlobal;
  return new Set(
    relays.filter((relay) =>
      [...reachedFrom(relay)].some((other) => isGlobal(other) && reachedFrom(other).has(relay))
    )
  );
});

/** Every relay a push of `from` leads to, relay by relay, `from` included when it leads back. */
function relaysReached(from: RawNode, queuedBy: ReadonlyMap<RawNode, readonly RawNode[]>): Set<RawNode> {
  const reached = new Set<RawNode>();
  const pending = [...(queuedBy.get(from) ?? [])];
  for (let next = pending.pop(); next; next = pending.pop()) {
    if (reached.has(next)) continue;
    reached.add(next);
    pending.push(...(queuedBy.get(next) ?? []));
  }
  return reached;
}

function flagsOf({ rawProperties: props }: RawNode): RemoteFlags {
  return readFlags({
    update_position: parseOptionalBool(props.update_position),
    update_rotation: parseOptionalBool(props.update_rotation),
    update_scale: parseOptionalBool(props.update_scale),
    use_global_coordinates: parseOptionalBool(props.use_global_coordinates),
  });
}

/**
 * The relays that a push of `relay` makes push again: each relay in global coordinates that its
 * move of the target reaches, and the target itself when it is a relay in local coordinates, as
 * its own local transform changed (`node_3d.cpp:398-400`, `canvas_item.h:173-178`). A relay with no
 * part flagged leaves the pose as it is, so it moves no cycle. A target on the relay's own line of
 * the tree is refused (`remote_transform_3d.cpp:37`), and a target in another file is not seen.
 */
function relaysAPushOfMoves(relay: RawNode, scene: RawScene): RawNode[] {
  if (!flagsAnyPart(flagsOf(relay))) return [];
  const path = extractNodePath(relay.rawProperties.remote_path ?? '');
  const resolved = path ? resolveNodePath(scene, relay, path) : null;
  if (resolved?.status !== 'found') return [];
  const target = resolved.node;
  const { space, reached } = RELAY_CLASSES[relay.type]!;
  if (!descendsFromClass(target.type, space) || isOnOneLine(relay, target, scene)) return [];
  return nodesAMoveReaches(target, reached).filter(
    (node) => node.type === relay.type && (flagsOf(node).useGlobal || node === target)
  );
}

/** Whether one node is the other or above it. */
function isOnOneLine(relay: RawNode, target: RawNode, scene: RawScene): boolean {
  return isAtOrAbove(relay, target, scene) || isAtOrAbove(target, relay, scene);
}

function isAtOrAbove(upper: RawNode, node: RawNode, scene: RawScene): boolean {
  for (let at: RawNode | null = node; at; at = parentIdentity(scene, at)) {
    if (at === upper) return true;
  }
  return false;
}

/**
 * `target` and the nodes below it that a move of it notifies: a child of the `reached` class that
 * is not `top_level` (`node_3d.cpp:106-133`, `canvas_item.cpp:1069-1101`).
 */
function nodesAMoveReaches(target: RawNode, reached: string): RawNode[] {
  const isReached = (child: RawNode): boolean =>
    descendsFromClass(child.type, reached) && parseOptionalBool(child.rawProperties.top_level) !== true;
  return [target, ...target.children.filter(isReached).flatMap((child) => nodesAMoveReaches(child, reached))];
}
