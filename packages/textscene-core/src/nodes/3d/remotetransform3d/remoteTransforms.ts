/**
 * The RemoteTransform pass. A RemoteTransform3D or RemoteTransform2D copies its own transform onto
 * the node its `remote_path` names on enter-tree (Godot's `_update_remote()`), so a static render
 * shows the target at the relay's transform. It is a description-level effect, not simulation, so
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
import { globalMatrix3D, matrixToTransform3D } from '../../../r3f/nodeTreeTransforms.js';
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
 * A relay reads the transforms the relays before it, in tree order, have already pushed, as Godot's
 * enter-tree order applies a one-direction chain. A feedback loop between relays is not iterated
 * to a fixed point. A target that is not a Node3D (for a RemoteTransform3D) or a Node2D
 * (for a RemoteTransform2D) takes nothing, as the cast fails (`remote_transform_3d.cpp:54`).
 */
export function applyRemoteTransforms(tree: LiveTree): NodePatches {
  const placed = new Map<string, NodePatch>();
  tree.fold<void, void>(undefined, (relay, _, descend) => {
    const { type } = relay.step.node;
    if (type === 'RemoteTransform3D') placeTarget3D(relay, tree, placed);
    else if (type === 'RemoteTransform2D') placeTarget2D(relay, tree, placed);
    descend();
  });
  return placed;
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

/** What a relay places: its target, flags and the chains that carry both to the scene root. */
interface Placement {
  readonly target: LiveLink;
  readonly flags: RemoteFlags;
  readonly relayChain: Map<string, TscnNode>;
  readonly targetChain: Map<string, TscnNode>;
  readonly parentPath: string | null;
}

/** The placement of `relay` onto a `targetClass` node, or null where it drives nothing. */
function placementOf(
  relay: LiveLink,
  tree: LiveTree,
  placed: Map<string, NodePatch>,
  targetClass: 'Node3D' | 'Node2D'
): Placement | null {
  const target = remoteTargetOf(relay, tree, targetClass);
  if (!target) return null;

  const flags = readFlags(relay.step.node.properties as RelayProps);
  // Local mode leaves the target at its authored transform in a static render (a matched pair,
  // measured). `_update_remote` keys off the relay's transform-changed notification, which the
  // global path satisfies on load and the local path does not.
  if (!flags.useGlobal) return null;
  // With no part flagged, the 2D relay returns (`remote_transform_2d.cpp:55-57`) and the 3D relay
  // writes the target's own transform back, so neither moves the target.
  if (!(flags.updatePosition || flags.updateRotation || flags.updateScale)) return null;

  return {
    target,
    flags,
    relayChain: nodesOnTheWayTo(tree, relay.path, placed),
    targetChain: nodesOnTheWayTo(tree, target.path, placed),
    parentPath: parentPathOf(target.path),
  };
}

function placeTarget3D(relay: LiveLink, tree: LiveTree, placed: Map<string, NodePatch>): void {
  const placement = placementOf(relay, tree, placed, 'Node3D');
  if (!placement) return;
  const { target, flags, relayChain, targetChain, parentPath } = placement;

  const desired = composeSelected3D(
    globalTransform3D(target.path, targetChain),
    globalTransform3D(relay.path, relayChain),
    flags
  );
  const parentGlobal = parentPath ? globalTransform3D(parentPath, targetChain) : identityTransform3D();

  placed.set(target.path, {
    transform: multiplyTransform3D(affineInverseTransform3D(parentGlobal), desired),
  });
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

function placeTarget2D(relay: LiveLink, tree: LiveTree, placed: Map<string, NodePatch>): void {
  const placement = placementOf(relay, tree, placed, 'Node2D');
  if (!placement) return;
  const { target, flags, relayChain, targetChain, parentPath } = placement;

  const desired = composeSelected2D(
    globalTransform2D(target.path, targetChain),
    globalTransform2D(relay.path, relayChain),
    flags
  );
  const parentGlobal = parentPath ? globalTransform2D(parentPath, targetChain) : TRANSFORM2D_IDENTITY;
  const newLocal = multiplyTransform2D(affineInverseTransform2D(parentGlobal), desired);

  // The parts Node2D reads from the matrix (`node_2d.cpp:127-133`), skew included.
  const { position, rotation, scale, skew } = transform2DDecompose(newLocal);
  placed.set(target.path, { position, rotation, scale, skew });
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
 * The global transform `target` takes from `relay` in global coordinates
 * (`remote_transform_2d.cpp:63-87`). It starts from the relay's matrix when the rotation is flagged,
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
