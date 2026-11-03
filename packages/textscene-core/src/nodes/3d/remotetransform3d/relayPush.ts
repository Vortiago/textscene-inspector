/**
 * One push of a RemoteTransform3D or RemoteTransform2D: the transform its `_update_remote()` sets on
 * the target (`remote_transform_3d.cpp:63-99`, `remote_transform_2d.cpp:47-107`), read from the poses
 * the RemoteTransform pass has placed so far.
 */

import type { TscnNode } from '../../../parser/types.js';
import { parentPathOf } from '../../../utils/nodePath.js';
import type { LiveLink, LiveTree } from '../../../r3f/liveSceneTree.js';
import { nodesOnTheWayTo } from '../../../r3f/liveGlobalTransform.js';
import type { NodePatch, NodePatches } from '../../../r3f/nodePatch.js';
import { globalMatrix3D, localMatrix3D, matrixToTransform3D } from '../../../r3f/nodeTreeTransforms.js';
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

export interface RemoteFlags {
  updatePosition: boolean;
  updateRotation: boolean;
  updateScale: boolean;
  useGlobal: boolean;
}

export interface RelayProps {
  remote_path?: string;
  update_position?: boolean;
  update_rotation?: boolean;
  update_scale?: boolean;
  use_global_coordinates?: boolean;
}

/** What one push reads: the relay, its target, the class the target must be and the flags. */
export interface Push {
  readonly link: LiveLink;
  readonly target: LiveLink;
  readonly space: 'Node3D' | 'Node2D';
  readonly flags: RemoteFlags;
}

/** Parse a relay's flags, each defaulting to Godot's `true`. */
export function readFlags(props: RelayProps): RemoteFlags {
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
export function moveTarget(relay: Push, tree: LiveTree, placed: Map<string, NodePatch>): boolean {
  return relay.space === 'Node3D' ? moveTarget3D(relay, tree, placed) : moveTarget2D(relay, tree, placed);
}

function moveTarget3D(relay: Push, tree: LiveTree, placed: Map<string, NodePatch>): boolean {
  // With no part flagged, the 3D relay sets the target's own transform back
  // (`remote_transform_3d.cpp:71-97`), so the pose stays and the set still notifies.
  if (!flagsAnyPart(relay.flags)) return true;
  placed.set(relay.target.path, { transform: newTargetLocal3D(relay, tree, placed) });
  return true;
}

/** The local transform `relay` gives its target, from the poses the pass has placed so far. */
function newTargetLocal3D({ link, target, flags }: Push, tree: LiveTree, placed: NodePatches): Transform3D {
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
export function localFromGlobal3D(
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

export function globalTransform3D(path: string, nodeByPath: Map<string, TscnNode>): Transform3D {
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

function moveTarget2D(relay: Push, tree: LiveTree, placed: Map<string, NodePatch>): boolean {
  // With no part flagged, the 2D relay returns before it sets anything (`remote_transform_2d.cpp:63-65`).
  if (!flagsAnyPart(relay.flags)) return false;
  // The parts Node2D reads from the matrix (`node_2d.cpp:127-133`), skew included.
  const { position, rotation, scale, skew } = transform2DDecompose(newTargetLocal2D(relay, tree, placed));
  placed.set(relay.target.path, { position, rotation, scale, skew });
  return true;
}

/** The local transform `relay` gives its target, from the poses the pass has placed so far. */
function newTargetLocal2D(
  { link, target, flags }: Push,
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
