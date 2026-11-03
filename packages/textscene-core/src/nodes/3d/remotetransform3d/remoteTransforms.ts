/**
 * The RemoteTransform pass. A RemoteTransform3D or RemoteTransform2D copies its own transform onto
 * the node its `remote_path` names (Godot's `_update_remote()`) each time a transform flush reaches
 * it. The pass replays the flushes up to one fixed frame, the one the `ref:godot` harness captures,
 * so a static render shows each target where that capture has it. The relay moves other nodes and
 * draws nothing itself, so ADR-0008 (what a node draws) does not govern it. It is a live scene pass
 * (ADR-0060), as Godot resolves the path with `get_node` on the live tree
 * (`remote_transform_3d.cpp:35-36`), across an instance border too. Measured on Godot 4.6.3.
 */

import { parentPathOf, relativeTo } from '../../../utils/nodePath.js';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { resolveNodePathLiteral } from '../../../godot/string/nodePath.js';
import type { LiveLink, LiveTree } from '../../../r3f/liveSceneTree.js';
import { liveGlobalTransform3D, nodesOnTheWayTo } from '../../../r3f/liveGlobalTransform.js';
import { uniquePathsOfLiteral } from '../../../r3f/nodePathUniqueNames.js';
import type { NodePatch, NodePatches } from '../../../r3f/nodePatch.js';
import { isTopLevelItem } from '../../../r3f/canvasPaintOrder.js';
import { sameData } from '../../../utils/sameData.js';
import type { Transform3D } from '../../../godot/math/transform3d.js';
import {
  HARNESS_CAPTURE,
  replayTransformFlushes,
  transformFlushesThrough,
  type QueueTransformChange,
} from '../../../godot/scene/transformFlushes.js';
import { DEFAULT_PHYSICS_CLOCK, type PhysicsClock } from '../../../godot/scene/physicsTicks.js';
import { perObject } from '../../../utils/perObject.js';
import { localFromGlobal3D, moveTarget, type Push, type RelayProps } from './relayPush.js';
import { RELAY_CLASSES, readFlags, type RelayClass, type Space } from './relayRules.js';

/**
 * The properties every RemoteTransform of `tree` pushes onto its target, by the target's live path.
 * Godot pushes a relay each time a transform flush reaches it (`remote_transform_3d.cpp:118-126`,
 * `remote_transform_2d.cpp:127-136`), and a push queues every relay its target carries, so the
 * pass replays the flushes up to the frame the `ref:godot` harness captures. A chain settles in the
 * first flushes, and a relay cycle takes the pose of that frame. A target that is not a Node3D (for
 * a RemoteTransform3D) or a Node2D (for a RemoteTransform2D) takes nothing, as the cast fails
 * (`remote_transform_3d.cpp:54`).
 */
export function applyRemoteTransforms(tree: LiveTree): NodePatches {
  const relays = relaysOf(tree);
  const placed = new Map<string, NodePatch>();
  if (relays.length === 0) return placed;

  const queuedBy = entriesQueuedByAMoveOf(tree, relays);
  const entered = entriesOnTheListAtEnterTree(tree, relays, queuedBy);
  const localRelayAt = new Map(relays.filter((r) => !r.flags.useGlobal).map((r) => [r.link.path, r]));
  // Godot recurses without end through a cycle of local relays and overflows its stack. The replay
  // stops at the relay that is already pushing.
  const pushing = new Set<Relay>();
  const push = (relay: Relay, queue: QueueTransformChange<ListEntry>): void => {
    if (pushing.has(relay) || !moveTarget(relay, tree, placed)) return;
    pushing.add(relay);
    for (const queued of queuedBy(relay)) queue(queued);
    // A local relay pushes the moment its own local transform changes (`node_3d.cpp:398-400`,
    // `canvas_item.h:173-178`).
    const localTarget = localRelayAt.get(relay.target.path);
    if (localTarget) push(localTarget, queue);
    pushing.delete(relay);
  };
  const flushes = harnessFlushes(tree.ctx.physicsClock ?? DEFAULT_PHYSICS_CLOCK);
  replayTransformFlushes(entered, flushes, (entry, queue) => {
    if (entry.kind === 'relay') push(entry, queue);
    else entry.drawn = liveGlobalTransform3D(tree, entry.link.path, placed)!;
  });
  placeWhereDrawn(
    entered.filter((entry): entry is Visual => entry.kind === 'visual'),
    tree,
    placed
  );
  return placed;
}

/** The flushes by the harness frame, once for each clock: a clock is one object per value pair. */
const harnessFlushes = perObject((clock: PhysicsClock) => transformFlushesThrough(HARNESS_CAPTURE, clock));

/** A RemoteTransform3D or RemoteTransform2D whose target Godot caches on enter-tree. */
interface Relay extends Push {
  readonly kind: 'relay';
}

/**
 * A VisualInstance3D a relay can move. Godot hands its global transform to the server only when a
 * flush notifies it (`visual_instance_3d.cpp:90-96`), so it draws where that left it.
 */
interface Visual {
  readonly kind: 'visual';
  readonly link: LiveLink;
  /** Written by the replay on each notification. Absent until the first. */
  drawn?: Transform3D;
}

/** What the replay keeps on the transform-change list: a relay, or a visual it can move. */
type ListEntry = Relay | Visual;

/** Every relay of `tree` that can move its target, in tree order. */
function relaysOf(tree: LiveTree): Relay[] {
  const relays: Relay[] = [];
  tree.fold<void, void>(undefined, (link, _, descend) => {
    const relayClass = RELAY_CLASSES[link.step.node.type];
    const target = relayClass && remoteTargetOf(link, tree, relayClass.space);
    if (target) {
      const flags = readFlags(link.step.node.properties as RelayProps);
      relays.push({ kind: 'relay', link, target, space: relayClass.space, flags });
    }
    descend();
  });
  return relays;
}

/**
 * The entries that entering the tree puts on the transform-change list, in tree order: every
 * visual a relay can move, a RemoteTransform3D in global coordinates, which alone asks for the
 * notification (`remote_transform_3d.cpp:101-102`, `node_3d.cpp:94`), and every RemoteTransform2D,
 * as every CanvasItem goes on the list (`canvas_item.cpp:365-367`).
 */
function entriesOnTheListAtEnterTree(
  tree: LiveTree,
  relays: readonly Relay[],
  queuedBy: (relay: Relay) => readonly ListEntry[]
): ListEntry[] {
  const entryAt = new Map<string, ListEntry>();
  for (const relay of relays) {
    if (relay.space === 'Node2D' || relay.flags.useGlobal) entryAt.set(relay.link.path, relay);
    for (const entry of queuedBy(relay)) entryAt.set(entry.link.path, entry);
  }
  const entered: ListEntry[] = [];
  tree.fold<void, void>(undefined, (link, _, descend) => {
    const entry = entryAt.get(link.path);
    if (entry) entered.push(entry);
    descend();
  });
  return entered;
}

/** The entries a push of each relay queues, cached by target, as {@link entriesQueuedBy} gives them. */
function entriesQueuedByAMoveOf(tree: LiveTree, relays: readonly Relay[]): (relay: Relay) => ListEntry[] {
  // Only a relay in global coordinates asks for the notification.
  const listenerAt = new Map<string, ListEntry>(
    relays.filter((r) => r.flags.useGlobal).map((r) => [r.link.path, r])
  );
  const queuedByTarget = new Map<string, ListEntry[]>();
  return ({ link, target }) => {
    let queued = queuedByTarget.get(target.path);
    if (!queued) {
      queued = entriesQueuedBy(target, RELAY_CLASSES[link.step.node.type]!.reached, tree, listenerAt);
      queuedByTarget.set(target.path, queued);
    }
    return queued;
  };
}

/**
 * The entries a move of `target` queues, in the order Godot queues them: a Node3D queues its Node3D
 * children's subtrees before itself (`node_3d.cpp:106-133`), a CanvasItem itself before its
 * CanvasItem children's (`canvas_item.cpp:1069-1101`). A `top_level` child keeps its place, so the
 * walk stops there. Each listener comes from `listenerAt`, and each visual it meets joins it.
 */
function entriesQueuedBy(
  target: LiveLink,
  family: RelayClass['reached'],
  tree: LiveTree,
  listenerAt: Map<string, ListEntry>
): ListEntry[] {
  const queued: ListEntry[] = [];
  const reaches = (child: LiveLink): boolean =>
    descendsFromClass(child.step.node.type, family) && !isTopLevelItem(child.step.node);
  const walk = (link: LiveLink): void => {
    const listener = listenerOrVisualAt(link, listenerAt);
    if (listener && family === 'CanvasItem') queued.push(listener);
    tree.fold<void, void>(undefined, (child) => (reaches(child) ? walk(child) : undefined), link);
    if (listener && family === 'Node3D') queued.push(listener);
  };
  walk(target);
  return queued;
}

/** The listener at `link`, or the visual it is, added to `listenerAt` on the first ask. */
function listenerOrVisualAt(link: LiveLink, listenerAt: Map<string, ListEntry>): ListEntry | undefined {
  const listener = listenerAt.get(link.path);
  if (listener || !descendsFromClass(link.step.node.type, 'VisualInstance3D')) return listener;
  const visual: Visual = { kind: 'visual', link };
  listenerAt.set(link.path, visual);
  return visual;
}

/**
 * Places each of `visuals`, in tree order, where its last notification drew it, when a move it
 * has not been notified of yet left it elsewhere. Its local transform under its parent's placed
 * pose gives that drawn pose, so each child keeps its own.
 */
function placeWhereDrawn(visuals: readonly Visual[], tree: LiveTree, placed: Map<string, NodePatch>): void {
  // Read every current pose before any visual moves, as a moved parent would carry its children.
  const lagging = visuals.filter(
    ({ link, drawn }) => drawn && !sameData(drawn, liveGlobalTransform3D(tree, link.path, placed))
  );
  for (const { link, drawn } of lagging) {
    const local = localFromGlobal3D(
      drawn!,
      parentPathOf(link.path),
      nodesOnTheWayTo(tree, link.path, placed)
    );
    placed.set(link.path, { ...placed.get(link.path), transform: local });
  }
}

/**
 * Whether the live paths put one node on the other's line of the tree: the same node, or one
 * above the other. Godot refuses such a target (`remote_transform_3d.cpp:37`).
 */
function isOnOneLine(path: string, otherPath: string): boolean {
  return relativeTo(path, otherPath) !== undefined || relativeTo(otherPath, path) !== undefined;
}

/**
 * The node `relay`'s `remote_path` names, when it descends from `targetClass` and is not the relay,
 * its ancestor or its descendant, else null.
 */
function remoteTargetOf(relay: LiveLink, tree: LiveTree, targetClass: Space): LiveLink | null {
  const remotePath = (relay.step.node.properties as RelayProps).remote_path;
  const targetPath = resolveNodePathLiteral(
    relay.path,
    remotePath,
    uniquePathsOfLiteral(remotePath, relay.path, tree)
  );
  const target = targetPath === null ? null : tree.at(targetPath);
  if (!target || isOnOneLine(relay.path, target.path)) return null;
  return descendsFromClass(target.step.node.type, targetClass) ? target : null;
}
