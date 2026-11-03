/**
 * The RemoteTransform pass. A RemoteTransform3D or RemoteTransform2D copies its own transform onto
 * the node its `remote_path` names (Godot's `_update_remote()`) each time a transform flush reaches
 * it, so a static render shows the target where the `ref:godot` harness capture has it. It is a description-level effect, not simulation, so
 * ADR-0008 (what a node draws) does not govern it. It is a live scene pass (ADR-0060), as Godot
 * resolves the path with `get_node` on the live tree (`remote_transform_3d.cpp:35-36`), across an
 * instance border too. Semantics are measured on Godot 4.6.3.
 */

import type { TscnNode } from '../../../parser/types.js';
import { parentPathOf, relativeTo } from '../../../utils/nodePath.js';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { resolveNodePathLiteral } from '../../../godot/string/nodePath.js';
import type { LiveLink, LiveTree } from '../../../r3f/liveSceneTree.js';
import { nodesOnTheWayTo } from '../../../r3f/liveGlobalTransform.js';
import { uniquePathsOfLiteral } from '../../../r3f/nodePathUniqueNames.js';
import type { NodePatch, NodePatches } from '../../../r3f/nodePatch.js';
import { globalMatrix3D, localMatrix3D, matrixToTransform3D } from '../../../r3f/nodeTreeTransforms.js';
import { isTopLevelItem } from '../../../r3f/canvasPaintOrder.js';
import {
  HARNESS_FRAME,
  replayTransformFlushes,
  transformFlushesThrough,
  type QueueTransformChange,
} from '../../../godot/scene/transformFlushes.js';
import { node2DLocalTransform } from '../../../r3f/node2dTransform.js';
import type { Node2DProperties } from '../../../nodes/base/node2d/types.js';
import {
  TRANSFORM2D_IDENTITY,
  affineInverseTransform2D,
  multiplyTransform2D,
  transform2DDecompose,
  transform2DGetScale,
  transform2DSetScale,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import {
  affineInverseTransform3D,
  identityTransform3D,
  multiplyTransform3D,
  transformColumnsAlong,
  type Transform3D,
} from '../../../godot/math/transform3d.js';

interface RemoteFlags {
  updatePosition: boolean;
  updateRotation: boolean;
  updateScale: boolean;
  useGlobal: boolean;
}

interface RelayProps {
  remote_path?: string;
  update_position?: boolean;
  update_rotation?: boolean;
  update_scale?: boolean;
  use_global_coordinates?: boolean;
}

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

  const queuedBy = relaysQueuedByAMoveOf(tree, relays);
  const localRelayAt = new Map(relays.filter((r) => !r.flags.useGlobal).map((r) => [r.link.path, r]));
  // Godot recurses without end through a ring of local relays and overflows its stack. The replay
  // stops at the relay that is already pushing.
  const pushing = new Set<Relay>();
  const push = (relay: Relay, queue: QueueTransformChange<Relay>): void => {
    if (pushing.has(relay) || !moveTarget(relay, tree, placed)) return;
    pushing.add(relay);
    for (const queued of queuedBy(relay.target)) queue(queued);
    // A local relay pushes the moment its own local transform changes (`node_3d.cpp:398-400`,
    // `canvas_item.h:173-178`).
    const localTarget = localRelayAt.get(relay.target.path);
    if (localTarget) push(localTarget, queue);
    pushing.delete(relay);
  };
  replayTransformFlushes(relays.filter(isOnTheListAtEnterTree), transformFlushesThrough(HARNESS_FRAME), push);
  return placed;
}

/** A RemoteTransform3D or RemoteTransform2D whose target Godot caches on enter-tree. */
interface Relay {
  readonly link: LiveLink;
  readonly target: LiveLink;
  readonly space: Space;
  readonly flags: RemoteFlags;
}

type Space = 'Node3D' | 'Node2D';

const SPACE_OF_RELAY: Readonly<Record<string, Space>> = {
  RemoteTransform3D: 'Node3D',
  RemoteTransform2D: 'Node2D',
};

/** Every relay of `tree` that can move its target, in tree order. */
function relaysOf(tree: LiveTree): Relay[] {
  const relays: Relay[] = [];
  tree.fold<void, void>(undefined, (link, _, descend) => {
    const space = SPACE_OF_RELAY[link.step.node.type];
    const target = space ? remoteTargetOf(link, tree, space) : null;
    if (space && target)
      relays.push({ link, target, space, flags: readFlags(link.step.node.properties as RelayProps) });
    descend();
  });
  return relays;
}

/**
 * Whether entering the tree puts `relay` on the transform-change list. A Node3D asks for transform
 * notifications only in global coordinates (`remote_transform_3d.cpp:101-102`, `node_3d.cpp:94`),
 * and every CanvasItem goes on the list (`canvas_item.cpp:365-367`).
 */
function isOnTheListAtEnterTree(relay: Relay): boolean {
  return relay.space === 'Node2D' || relay.flags.useGlobal;
}

/** The relays a move of each target queues, cached by target, as {@link relaysQueuedBy} gives them. */
function relaysQueuedByAMoveOf(tree: LiveTree, relays: readonly Relay[]): (target: LiveLink) => Relay[] {
  // Only a relay in global coordinates asks for the notification.
  const listenerAt = new Map(relays.filter((r) => r.flags.useGlobal).map((r) => [r.link.path, r]));
  const queuedByTarget = new Map<string, Relay[]>();
  return (target) => {
    let queued = queuedByTarget.get(target.path);
    if (!queued) {
      queued = relaysQueuedBy(target, tree, listenerAt);
      queuedByTarget.set(target.path, queued);
    }
    return queued;
  };
}

/**
 * The relays of `listenerAt` that a move of `target` queues, in the order Godot queues them: a
 * Node3D queues its Node3D children's subtrees before itself (`node_3d.cpp:106-133`), a CanvasItem
 * itself before its CanvasItem children's (`canvas_item.cpp:1069-1101`). A `top_level` child keeps
 * its place, so the walk stops there.
 */
function relaysQueuedBy(target: LiveLink, tree: LiveTree, listenerAt: ReadonlyMap<string, Relay>): Relay[] {
  const family = descendsFromClass(target.step.node.type, 'Node3D') ? 'Node3D' : 'CanvasItem';
  const queued: Relay[] = [];
  const reaches = (child: LiveLink): boolean =>
    descendsFromClass(child.step.node.type, family) && !isTopLevelItem(child.step.node);
  const walk = (link: LiveLink): void => {
    const listener = listenerAt.get(link.path);
    if (listener && family === 'CanvasItem') queued.push(listener);
    tree.fold<void, void>(undefined, (child) => (reaches(child) ? walk(child) : undefined), link);
    if (listener && family === 'Node3D') queued.push(listener);
  };
  walk(target);
  return queued;
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
function remoteTargetOf(relay: LiveLink, tree: LiveTree, targetClass: 'Node3D' | 'Node2D'): LiveLink | null {
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

/** Parse a relay's flags, each defaulting to Godot's `true`. */
function readFlags(props: RelayProps): RemoteFlags {
  return {
    updatePosition: props.update_position !== false,
    updateRotation: props.update_rotation !== false,
    updateScale: props.update_scale !== false,
    useGlobal: props.use_global_coordinates !== false,
  };
}

function flagsAnyPart({ updatePosition, updateRotation, updateScale }: RemoteFlags): boolean {
  return updatePosition || updateRotation || updateScale;
}

/** Moves `relay`'s target as `_update_remote` does, and whether Godot sets the target's transform. */
function moveTarget(relay: Relay, tree: LiveTree, placed: Map<string, NodePatch>): boolean {
  return relay.space === 'Node3D' ? moveTarget3D(relay, tree, placed) : moveTarget2D(relay, tree, placed);
}

function moveTarget3D(relay: Relay, tree: LiveTree, placed: Map<string, NodePatch>): boolean {
  // With no part flagged, the 3D relay sets the target's own transform back
  // (`remote_transform_3d.cpp:71-97`), so the pose stays and the set still notifies.
  if (!flagsAnyPart(relay.flags)) return true;
  placed.set(relay.target.path, { transform: newTargetLocal3D(relay, tree, placed) });
  return true;
}

/** The local transform `relay` gives its target, from the poses the pass has placed so far. */
function newTargetLocal3D({ link, target, flags }: Relay, tree: LiveTree, placed: NodePatches): Transform3D {
  const relayChain = nodesOnTheWayTo(tree, link.path, placed);
  const targetChain = nodesOnTheWayTo(tree, target.path, placed);
  if (!flags.useGlobal) {
    return composeSelected3D(
      localTransform3D(targetChain.get(target.path)!),
      localTransform3D(relayChain.get(link.path)!),
      flags
    );
  }
  const global = composeSelected3D(
    globalTransform3D(target.path, targetChain),
    globalTransform3D(link.path, relayChain),
    flags
  );
  return localFromGlobal3D(global, parentPathOf(target.path), targetChain);
}

/** The local transform that puts a node under `parentPath` at `global` (`node_3d.cpp:413-420`). */
function localFromGlobal3D(
  global: Transform3D,
  parentPath: string | null,
  chain: Map<string, TscnNode>
): Transform3D {
  const parentGlobal = parentPath ? globalTransform3D(parentPath, chain) : identityTransform3D();
  return multiplyTransform3D(affineInverseTransform3D(parentGlobal), global);
}

function localTransform3D(node: TscnNode): Transform3D {
  return matrixToTransform3D(localMatrix3D(node));
}

function globalTransform3D(path: string, nodeByPath: Map<string, TscnNode>): Transform3D {
  return matrixToTransform3D(globalMatrix3D(path, nodeByPath));
}

/**
 * The global transform `target` takes from `relay` (`_update_remote`, `remote_transform_3d.cpp:63-99`).
 * The flagged parts come from the relay: the whole basis for rotation and scale, the direction of
 * each column for rotation, the length of each column for scale, the origin for position. The basis
 * is never decomposed, so a shear and a mirror stay as they are.
 */
function composeSelected3D(target: Transform3D, relay: Transform3D, flags: RemoteFlags): Transform3D {
  const { updatePosition, updateRotation, updateScale } = flags;
  if (updatePosition && updateRotation && updateScale) return relay;

  const origin = updatePosition ? relay.origin : target.origin;
  if (updateRotation && updateScale) return { ...relay, origin };
  if (updateRotation) return { ...transformColumnsAlong(relay, target), origin };
  if (updateScale) return { ...transformColumnsAlong(target, relay), origin };
  return { ...target, origin };
}

function moveTarget2D(relay: Relay, tree: LiveTree, placed: Map<string, NodePatch>): boolean {
  // With no part flagged, the 2D relay returns before it sets anything (`remote_transform_2d.cpp:63-65`).
  if (!flagsAnyPart(relay.flags)) return false;
  // The parts Node2D reads from the matrix (`node_2d.cpp:127-133`), skew included.
  const { position, rotation, scale, skew } = transform2DDecompose(newTargetLocal2D(relay, tree, placed));
  placed.set(relay.target.path, { position, rotation, scale, skew });
  return true;
}

/** The local transform `relay` gives its target, from the poses the pass has placed so far. */
function newTargetLocal2D(
  { link, target, flags }: Relay,
  tree: LiveTree,
  placed: NodePatches
): Transform2DColumns {
  const relayChain = nodesOnTheWayTo(tree, link.path, placed);
  const targetChain = nodesOnTheWayTo(tree, target.path, placed);
  if (!flags.useGlobal) {
    return composeSelected2D(
      localTransform2D(targetChain.get(target.path)!),
      localTransform2D(relayChain.get(link.path)!),
      flags
    );
  }
  const global = composeSelected2D(
    globalTransform2D(target.path, targetChain),
    globalTransform2D(link.path, relayChain),
    flags
  );
  return localFromGlobal2D(global, parentPathOf(target.path), targetChain);
}

/** The local transform that puts a node under `parentPath` at `global` (`node_2d.cpp:384-392`). */
function localFromGlobal2D(
  global: Transform2DColumns,
  parentPath: string | null,
  chain: Map<string, TscnNode>
): Transform2DColumns {
  const parentGlobal = parentPath ? globalTransform2D(parentPath, chain) : TRANSFORM2D_IDENTITY;
  return multiplyTransform2D(affineInverseTransform2D(parentGlobal), global);
}

function localTransform2D(node: TscnNode): Transform2DColumns {
  const props = node.properties as Partial<Node2DProperties>;
  if (!props || props.position === undefined) return TRANSFORM2D_IDENTITY;
  return node2DLocalTransform(props);
}

function globalTransform2D(path: string, nodeByPath: Map<string, TscnNode>): Transform2DColumns {
  let result = TRANSFORM2D_IDENTITY;
  let acc = '';
  for (const segment of path.split('/')) {
    acc = acc ? `${acc}/${segment}` : segment;
    const node = nodeByPath.get(acc);
    if (node) result = multiplyTransform2D(result, localTransform2D(node));
  }
  return result;
}

/**
 * The transform `target` takes from `relay`, in global or in local coordinates, whichever the two
 * arguments are in (`remote_transform_2d.cpp:63-107`). It starts from the relay's matrix when the rotation is flagged,
 * else from the target's. Position then differs by an exclusive-or against rotation, and scale
 * likewise: a flag that differs from the rotation flag swaps that part to the flagged side.
 */
function composeSelected2D(
  target: Transform2DColumns,
  relay: Transform2DColumns,
  flags: RemoteFlags
): Transform2DColumns {
  const { updatePosition, updateRotation, updateScale } = flags;
  if (updatePosition && updateRotation && updateScale) return relay;

  let composed = updateRotation ? relay : target;
  if (updateRotation !== updatePosition) {
    const origin = updatePosition ? relay : target;
    composed = { ...composed, tx: origin.tx, ty: origin.ty };
  }
  if (updateRotation !== updateScale) {
    composed = transform2DSetScale(composed, transform2DGetScale(updateScale ? relay : target));
  }
  return composed;
}
