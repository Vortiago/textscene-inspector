/**
 * The relay cycle check of RemoteTransform3D and RemoteTransform2D. A push moves the target, which
 * queues every relay the target carries, and that relay pushes on the next transform flush
 * (`remote_transform_3d.cpp:118-126`, `remote_transform_2d.cpp:127-136`). A relay cycle so
 * pushes on every frame without end, and no one frame's pose is the game's pose.
 */

import type { RawNode, RawScene } from '../../../parser/types.js';
import type { Diagnostic, RuleArm, RuleContext } from '../../../linter/types.js';
import { armDiagnostic } from '../../../linter/ruleArms.js';
import { extractNodePath } from '../../../linter/linterUtils.js';
import { resolveNodePath } from '../../../linter/nodePathResolve.js';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import { perObject } from '../../../utils/perObject.js';

/** What sets each relay class apart: the class its target must be, and the class a move reaches. */
const RELAY_CLASSES: Readonly<Record<string, { target: string; reached: string }>> = {
  RemoteTransform3D: { target: 'Node3D', reached: 'Node3D' },
  RemoteTransform2D: { target: 'Node2D', reached: 'CanvasItem' },
};

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

/** The relays of `scene` on a cycle, each reaching itself through the relays its push queues. */
const relaysInACycle = perObject((scene: RawScene): ReadonlySet<RawNode> => {
  const relays = scene.nodes.flatMap(nodesBelow).filter((node) => node.type in RELAY_CLASSES);
  const queuedBy = new Map(relays.map((relay) => [relay, relaysQueuedByAPushOf(relay, scene)]));
  return new Set(relays.filter((relay) => reaches(relay, relay, queuedBy)));
});

/** `node` and every node below it, in tree order. */
function nodesBelow(node: RawNode): RawNode[] {
  return [node, ...node.children.flatMap(nodesBelow)];
}

/** Whether a push of `from` leads, relay by relay, to `to`. */
function reaches(from: RawNode, to: RawNode, queuedBy: ReadonlyMap<RawNode, readonly RawNode[]>): boolean {
  const seen = new Set<RawNode>();
  const pending = [...(queuedBy.get(from) ?? [])];
  for (let next = pending.pop(); next; next = pending.pop()) {
    if (next === to) return true;
    if (seen.has(next)) continue;
    seen.add(next);
    pending.push(...(queuedBy.get(next) ?? []));
  }
  return false;
}

/**
 * The relays that a push of `relay` makes push again: those its move of the target reaches. A
 * relay in local coordinates pushes only when its own local transform changes, and a relay with no
 * part flagged leaves the pose as it is, so neither moves a cycle. A target on the relay's own line
 * of the tree is refused (`remote_transform_3d.cpp:37`), and a target in another file is not seen.
 */
function relaysQueuedByAPushOf(relay: RawNode, scene: RawScene): RawNode[] {
  if (!movesInGlobalCoordinates(relay)) return [];
  const path = extractNodePath(relay.rawProperties.remote_path ?? '');
  const resolved = path ? resolveNodePath(scene, relay, path) : null;
  if (resolved?.status !== 'found') return [];
  const target = resolved.node;
  const { target: targetClass, reached } = RELAY_CLASSES[relay.type]!;
  if (!descendsFromClass(target.type, targetClass) || isOnOneLine(relay, target)) return [];
  return nodesAMoveReaches(target, reached).filter((node) => node.type === relay.type);
}

function movesInGlobalCoordinates({ rawProperties: props }: RawNode): boolean {
  const flag = (key: string): boolean => boolSlotValue(props[key]) !== false;
  return (
    flag('use_global_coordinates') &&
    (flag('update_position') || flag('update_rotation') || flag('update_scale'))
  );
}

function isOnOneLine(relay: RawNode, target: RawNode): boolean {
  return nodesBelow(relay).includes(target) || nodesBelow(target).includes(relay);
}

/**
 * `target` and the nodes below it that a move of it notifies: a child of the `reached` class that
 * is not `top_level` (`node_3d.cpp:106-133`, `canvas_item.cpp:1069-1101`).
 */
function nodesAMoveReaches(target: RawNode, reached: string): RawNode[] {
  const isReached = (child: RawNode): boolean =>
    descendsFromClass(child.type, reached) && boolSlotValue(child.rawProperties.top_level) !== true;
  return [target, ...target.children.filter(isReached).flatMap((child) => nodesAMoveReaches(child, reached))];
}
