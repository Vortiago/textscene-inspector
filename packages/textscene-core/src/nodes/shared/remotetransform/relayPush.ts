/**
 * One push of a RemoteTransform3D or RemoteTransform2D: the transform its `_update_remote()` sets on
 * the target (`remote_transform_3d.cpp:63-99`, `remote_transform_2d.cpp:47-107`), read from the poses
 * the RemoteTransform pass has placed so far.
 */

import type { TscnNode } from '../../../parser/types.js';
import { parentPathOf } from '../../../utils/nodePath.js';
import type { LiveLink, LiveTree } from '../../../r3f/liveSceneTree.js';
import { nodesOnTheWayTo } from '../../../r3f/liveGlobalTransform.js';
import { NO_PATCHES, type NodePatch, type PatchLookup } from '../../../r3f/nodePatch.js';
import { globalMatrix3D, localMatrix3D, matrixToTransform3D } from '../../../r3f/nodeTreeTransforms.js';
import { transform2DOnCanvas } from '../../../r3f/liveTransform2D.js';
import { localTransform2D, type Node2DPose } from '../../canvasitem/shared/globalTransform2D.js';
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

/** What a push reads of one space: the transforms of nodes the pass has posed, null for one it cannot decode. */
interface SpaceReader<T> {
  local(path: string): T | null;
  global(path: string): T | null;
  localFromGlobal(global: T, parentPath: string | null): T | null;
}

/** The transform maths of one space, which a push composes the same way in both. */
interface SpaceMath<T> {
  readerOver(tree: LiveTree, posed: PatchLookup): SpaceReader<T>;
  compose(target: T, relay: T, flags: RemoteFlags): T;
}

/** The chain of nodes to a path, built once for each path, as a push asks for a path more than once. */
function chainsOver(tree: LiveTree, posed: PatchLookup): (path: string) => Map<string, TscnNode> {
  const chains = new Map<string, Map<string, TscnNode>>();
  return (path) => {
    if (!chains.has(path)) chains.set(path, nodesOnTheWayTo(tree, path, posed));
    return chains.get(path)!;
  };
}

function reader3D(tree: LiveTree, posed: PatchLookup): SpaceReader<Transform3D> {
  const chainTo = chainsOver(tree, posed);
  return {
    local: (path) => localTransform3D(chainTo(path).get(path)!),
    global: (path) => globalTransform3D(path, chainTo(path)),
    localFromGlobal: (global, parentPath) =>
      localFromGlobal3D(global, parentPath, parentPath ? chainTo(parentPath) : new Map()),
  };
}

/** The stored nodes with the poses of `posed` beside them, as `resolveGlobalTransform2D` reads a pose. */
function reader2D(tree: LiveTree, posed: PatchLookup): SpaceReader<Transform2DColumns> {
  const chainTo = chainsOver(tree, NO_PATCHES);
  const global = (path: string) => transform2DOnCanvas(path, chainTo(path), posed);
  return {
    local: (path) => localTransform2D(chainTo(path).get(path)!, posed.get(path) as Node2DPose | undefined),
    global,
    localFromGlobal: (target, parentPath) => {
      const parentGlobal = parentPath ? global(parentPath) : TRANSFORM2D_IDENTITY;
      // The local transform that puts a node under `parentPath` at `target` (`node_2d.cpp:384-392`).
      return parentGlobal && multiplyTransform2D(affineInverseTransform2D(parentGlobal), target);
    },
  };
}

const SPACE_3D: SpaceMath<Transform3D> = { readerOver: reader3D, compose: composeSelected3D };
const SPACE_2D: SpaceMath<Transform2DColumns> = { readerOver: reader2D, compose: composeSelected2D };

/**
 * Moves `relay`'s target as `_update_remote` does, and whether Godot sets the target's transform.
 * A 2D push reads the poses in `posed`, which holds what `placed` holds and the solved bones below it.
 * A 2D push whose chain this cannot decode sets nothing.
 */
export function moveTarget(
  relay: Push,
  tree: LiveTree,
  placed: Map<string, NodePatch>,
  posed: PatchLookup
): boolean {
  if (!flagsAnyPart(relay.flags)) return pushSetsTarget(relay.space, relay.flags);
  if (relay.space === 'Node3D') {
    const local = newTargetLocal(relay, SPACE_3D, tree, placed);
    if (local === null) return false;
    placed.set(relay.target.path, { transform: local });
    return true;
  }
  const local = newTargetLocal(relay, SPACE_2D, tree, posed);
  if (local === null) return false;
  // The parts Node2D reads from the matrix (`node_2d.cpp:127-133`), skew included.
  const { position, rotation, scale, skew } = transform2DDecompose(local);
  placed.set(relay.target.path, { position, rotation, scale, skew });
  return true;
}

/**
 * The local transform `relay` gives its target, from the poses the pass has posed so far. With
 * every part flagged the relay's pose is the target's, so the target's own is not read.
 */
function newTargetLocal<T>(
  { link, target, flags }: Push,
  math: SpaceMath<T>,
  tree: LiveTree,
  posed: PatchLookup
): T | null {
  const reads = math.readerOver(tree, posed);
  const every = flagsEveryPart(flags);
  if (!flags.useGlobal) {
    const relayLocal = reads.local(link.path);
    if (relayLocal === null || every) return relayLocal;
    const targetLocal = reads.local(target.path);
    return targetLocal && math.compose(targetLocal, relayLocal, flags);
  }
  const relayGlobal = reads.global(link.path);
  if (relayGlobal === null) return null;
  const targetGlobal = every ? relayGlobal : reads.global(target.path);
  const global = every ? relayGlobal : targetGlobal && math.compose(targetGlobal, relayGlobal, flags);
  return global && reads.localFromGlobal(global, parentPathOf(target.path));
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
