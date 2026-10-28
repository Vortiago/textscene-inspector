/**
 * The RemoteTransform pass. A RemoteTransform3D or RemoteTransform2D copies its own transform onto
 * the node its `remote_path` names on enter-tree (Godot's `_update_remote()`), so a static render
 * shows the target at the relay's transform. It is a description-level effect, not simulation, so
 * ADR-0008 (what a node draws) does not govern it. It is a live scene pass (ADR-0060), as Godot
 * resolves the path with `get_node` on the live tree (`remote_transform_3d.cpp:35-36`), across an
 * instance border too. Semantics are measured on Godot 4.6.3.
 */

import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types.js';
import { parentPathOf } from '../../../utils/nodePath.js';
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
  transform2DFromParts,
  transform2DGetScale,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import type { Vector2 } from '../../../godot/math/vector.js';

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
 * enter-tree order applies a one-direction chain. A relay that drives its own ancestor is not
 * iterated to a fixed point. A target that is not a Node3D (for a RemoteTransform3D) or a Node2D
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

/** The node `relay`'s `remote_path` names, when it descends from `targetClass`, else null. */
function remoteTargetOf(relay: LiveLink, tree: LiveTree, targetClass: 'Node3D' | 'Node2D'): LiveLink | null {
  const remotePath = (relay.step.node.properties as RelayProps).remote_path;
  const targetPath = resolveNodePathLiteral(
    relay.path,
    remotePath,
    uniquePathsOfLiteral(remotePath, relay.path, tree)
  );
  const target = targetPath === null ? null : tree.at(targetPath);
  return target && descendsFromClass(target.step.node.type, targetClass) ? target : null;
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
    globalMatrix3D(target.path, targetChain),
    globalMatrix3D(relay.path, relayChain),
    flags
  );
  const parentGlobal = parentPath ? globalMatrix3D(parentPath, targetChain) : new THREE.Matrix4();
  const newLocal = parentGlobal.clone().invert().multiply(desired);

  placed.set(target.path, { transform: matrixToTransform3D(newLocal) });
}

/**
 * `base` with each flagged component (position, rotation, scale) taken from `source`, composed in
 * global space, as the 2D path is too. This matches Godot exactly when the target's parent has no
 * rotation or scale. Under a rotated or scaled parent, Godot's `set_rotation`/`set_scale` quirk diverges.
 */
function composeSelected3D(base: THREE.Matrix4, source: THREE.Matrix4, flags: RemoteFlags): THREE.Matrix4 {
  if (flags.updatePosition && flags.updateRotation && flags.updateScale) {
    return source.clone();
  }
  const bp = new THREE.Vector3();
  const bq = new THREE.Quaternion();
  const bs = new THREE.Vector3();
  base.decompose(bp, bq, bs);
  const sp = new THREE.Vector3();
  const sq = new THREE.Quaternion();
  const ss = new THREE.Vector3();
  source.decompose(sp, sq, ss);
  return new THREE.Matrix4().compose(
    flags.updatePosition ? sp : bp,
    flags.updateRotation ? sq : bq,
    flags.updateScale ? ss : bs
  );
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

  // Godot's RemoteTransform2D pushes position, rotation and scale only. The target keeps its `skew`.
  const { position, rotation, scale } = decomposeTransform2D(newLocal);
  placed.set(target.path, { position, rotation, scale });
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

function composeSelected2D(
  base: Transform2DColumns,
  source: Transform2DColumns,
  flags: RemoteFlags
): Transform2DColumns {
  const b = decomposeTransform2D(base);
  const s = decomposeTransform2D(source);
  return transform2DFromParts(
    flags.updateRotation ? s.rotation : b.rotation,
    flags.updateScale ? s.scale : b.scale,
    0,
    flags.updatePosition ? s.position : b.position
  );
}

/**
 * Godot Transform2D decomposition into position, rotation (`get_rotation`, `transform_2d.cpp:82-84`)
 * and scale. Skew is dropped.
 */
function decomposeTransform2D(m: Transform2DColumns): {
  position: Vector2;
  rotation: number;
  scale: Vector2;
} {
  return {
    position: { x: m.tx, y: m.ty },
    rotation: Math.atan2(m.b, m.a),
    scale: transform2DGetScale(m),
  };
}
