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
import { flagsAnyPart, flagsEveryPart, pushSetsTarget, type RemoteFlags, type Space } from './relayRules.js';

/** What one push reads: the relay, its target, the class the target must be and the flags. */
export interface Push {
  readonly link: LiveLink;
  readonly target: LiveLink;
  readonly space: Space;
  readonly flags: RemoteFlags;
}

/** The transform maths of one space, which a push composes the same way in both. */
interface SpaceMath<T> {
  local(node: TscnNode): T;
  global(path: string, chain: Map<string, TscnNode>): T;
  compose(target: T, relay: T, flags: RemoteFlags): T;
  localFromGlobal(global: T, parentPath: string | null, chain: Map<string, TscnNode>): T;
}

const SPACE_3D: SpaceMath<Transform3D> = {
  local: localTransform3D,
  global: globalTransform3D,
  compose: composeSelected3D,
  localFromGlobal: localFromGlobal3D,
};

const SPACE_2D: SpaceMath<Transform2DColumns> = {
  local: localTransform2D,
  global: globalTransform2D,
  compose: composeSelected2D,
  localFromGlobal: localFromGlobal2D,
};

/** Moves `relay`'s target as `_update_remote` does, and whether Godot sets the target's transform. */
export function moveTarget(relay: Push, tree: LiveTree, placed: Map<string, NodePatch>): boolean {
  if (!flagsAnyPart(relay.flags)) return pushSetsTarget(relay.space, relay.flags);
  if (relay.space === 'Node3D') {
    placed.set(relay.target.path, { transform: newTargetLocal(relay, tree, placed, SPACE_3D) });
  } else {
    // The parts Node2D reads from the matrix (`node_2d.cpp:127-133`), skew included.
    const { position, rotation, scale, skew } = transform2DDecompose(
      newTargetLocal(relay, tree, placed, SPACE_2D)
    );
    placed.set(relay.target.path, { position, rotation, scale, skew });
  }
  return true;
}

/**
 * The local transform `relay` gives its target, from the poses the pass has placed so far. With
 * every part flagged the relay's pose is the target's, so the target's own is not read.
 */
function newTargetLocal<T>(
  { link, target, flags }: Push,
  tree: LiveTree,
  placed: NodePatches,
  math: SpaceMath<T>
): T {
  const relayChain = nodesOnTheWayTo(tree, link.path, placed);
  const targetChain = nodesOnTheWayTo(tree, target.path, placed);
  const every = flagsEveryPart(flags);
  if (!flags.useGlobal) {
    const relayLocal = math.local(relayChain.get(link.path)!);
    return every ? relayLocal : math.compose(math.local(targetChain.get(target.path)!), relayLocal, flags);
  }
  const relayGlobal = math.global(link.path, relayChain);
  const global = every
    ? relayGlobal
    : math.compose(math.global(target.path, targetChain), relayGlobal, flags);
  return math.localFromGlobal(global, parentPathOf(target.path), targetChain);
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
  const origin = updatePosition ? relay.origin : target.origin;
  if (updateRotation && updateScale) return { ...relay, origin };
  if (updateRotation) return { ...transformColumnsAlong(relay, target), origin };
  if (updateScale) return { ...transformColumnsAlong(target, relay), origin };
  return { ...target, origin };
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
