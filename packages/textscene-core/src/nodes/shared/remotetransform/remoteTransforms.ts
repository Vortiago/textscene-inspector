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
import { sameData } from '../../../utils/sameData.js';
import type { Transform3D } from '../../../godot/math/transform3d.js';
import {
  HARNESS_CAPTURE,
  replayTransformFlushes,
  transformFlushesThrough,
  type QueueTransformChange,
} from '../../../godot/scene/transformFlushes.js';
import type { PhysicsClock } from '../../../godot/scene/physicsTicks.js';
import { perObject } from '../../../utils/perObject.js';
import { localFromGlobal3D, moveTarget, type Push } from './relayPush.js';
import type { RelayClass } from './relayRules.js';
import { childrenAMoveCarries, nodesAMoveReaches, relayOf, type RelayTreeView } from './relayTree.js';

/** Where the RemoteTransform pass leaves the nodes of a tree, by live path. */
export interface RelayPoses {
  /** The properties each relay pushes onto its target: the node's own pose. */
  readonly placed: NodePatches;
  /**
   * The transforms render lays over `placed`: a mesh that draws behind its node, as Godot's renderer
   * holds the pose its last notification gave it, and each node below it that is no mesh, so it
   * still stands at its own pose. The node's properties never hold them.
   */
  readonly drawn: NodePatches;
}

const NO_POSES: RelayPoses = { placed: new Map(), drawn: new Map() };

/**
 * Where the relays of `tree` leave its nodes. Godot pushes a relay each time a transform flush
 * reaches it (`remote_transform_3d.cpp:118-126`, `remote_transform_2d.cpp:127-136`), and a push
 * queues every relay its target carries, so the pass replays the flushes up to the frame the
 * `ref:godot` harness captures. A chain settles in the first flushes, and a relay cycle takes the
 * pose of that frame. `relayOf` says which targets Godot refuses.
 */
export function applyRemoteTransforms(tree: LiveTree): RelayPoses {
  const relays = relaysOf(tree);
  if (relays.length === 0) return NO_POSES;
  const placed = new Map<string, NodePatch>();

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
  const flushes = harnessFlushes(tree.ctx.physicsClock);
  replayTransformFlushes(entered, flushes, (entry, queue) => {
    if (entry.kind === 'relay') push(entry, queue);
    else entry.notified = liveGlobalTransform3D(tree, entry.link.path, placed)!;
  });
  const drawn = drawnTransformsOf(
    entered.filter((entry): entry is Visual => entry.kind === 'visual'),
    tree,
    placed
  );
  return { placed, drawn };
}

/** The flushes by the harness frame, once for each clock: a clock is one object per value pair. */
const harnessFlushes = perObject((clock: PhysicsClock) => transformFlushesThrough(HARNESS_CAPTURE, clock));

/** A RemoteTransform3D or RemoteTransform2D whose target Godot caches on enter-tree. */
interface Relay extends Push {
  readonly kind: 'relay';
  readonly reached: RelayClass['reached'];
}

/**
 * A VisualInstance3D a relay can move. Godot hands its global transform to the server only when a
 * flush notifies it (`visual_instance_3d.cpp:90-96`), so it draws where that left it.
 */
interface Visual {
  readonly kind: 'visual';
  readonly link: LiveLink;
  /** The global pose its last notification handed the server. Written by the replay. Absent until the first. */
  notified?: Transform3D;
}

/** What the replay keeps on the transform-change list: a relay, or a visual it can move. */
type ListEntry = Relay | Visual;

/** The live tree as the relay walk reads it. A `%Name` resolves through the tree's unique names. */
const liveRelayView = perObject((tree: LiveTree): RelayTreeView<LiveLink> => ({
  typeOf: (link) => link.step.node.type,
  rawPropertiesOf: (link) => link.step.node.rawProperties,
  childrenOf: (link) => tree.fold<void, LiveLink>(undefined, (child) => child, link),
  isAtOrAbove: (upper, link) => relativeTo(upper.path, link.path) !== undefined,
  nodeAt: (from, literal) => {
    const path = resolveNodePathLiteral(from.path, literal, uniquePathsOfLiteral(literal, from.path, tree));
    return path === null ? null : tree.at(path);
  },
}));

/** Every relay of `tree` that can move its target, in tree order. */
function relaysOf(tree: LiveTree): Relay[] {
  const view = liveRelayView(tree);
  const relays: Relay[] = [];
  tree.fold<void, void>(undefined, (link, _, descend) => {
    const relay = relayOf(view, link);
    if (relay) {
      const { target, relayClass, flags } = relay;
      relays.push({
        kind: 'relay',
        link,
        target,
        space: relayClass.space,
        reached: relayClass.reached,
        flags,
      });
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
  return ({ target, reached }) => {
    let queued = queuedByTarget.get(target.path);
    if (!queued) {
      queued = entriesQueuedBy(target, reached, tree, listenerAt);
      queuedByTarget.set(target.path, queued);
    }
    return queued;
  };
}

/**
 * The entries a move of `target` queues, in the order Godot queues them ({@link nodesAMoveReaches}).
 * Each listener comes from `listenerAt`, and each visual it meets joins it.
 */
function entriesQueuedBy(
  target: LiveLink,
  reached: RelayClass['reached'],
  tree: LiveTree,
  listenerAt: Map<string, ListEntry>
): ListEntry[] {
  return nodesAMoveReaches(liveRelayView(tree), target, reached).flatMap(
    (link) => listenerOrVisualAt(link, listenerAt) ?? []
  );
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
 * The local transforms render needs so each of `visuals` stands where its last notification drew
 * it, and each Node3D below a moved one that is no visual stands at its node pose: a parent drawn
 * elsewhere carries its children in render, but in Godot only the visual's own instance lags.
 */
function drawnTransformsOf(visuals: readonly Visual[], tree: LiveTree, placed: NodePatches): NodePatches {
  const drawn = new Map<string, NodePatch>();
  const drawnPoses = new Map(placed);
  const visualPaths = new Set(visuals.map(({ link }) => link.path));
  const nodePose = (link: LiveLink): Transform3D => liveGlobalTransform3D(tree, link.path, placed)!;
  const standAt = (link: LiveLink, global: Transform3D): boolean => {
    if (sameData(global, liveGlobalTransform3D(tree, link.path, drawnPoses))) return false;
    const local = localFromGlobal3D(
      global,
      parentPathOf(link.path),
      nodesOnTheWayTo(tree, link.path, drawnPoses)
    );
    drawn.set(link.path, { transform: local });
    drawnPoses.set(link.path, { ...drawnPoses.get(link.path), transform: local });
    return true;
  };
  // Each pose is read after the nodes above it have moved, as a moved parent carries its children.
  for (const visual of visuals) {
    if (!standAt(visual.link, visual.notified ?? nodePose(visual.link))) continue;
    for (const child of childrenAMoveCarries(liveRelayView(tree), visual.link, 'Node3D')) {
      if (!visualPaths.has(child.path)) standAt(child, nodePose(child));
    }
  }
  return drawn;
}
