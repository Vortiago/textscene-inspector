/**
 * The RemoteTransform pass. A RemoteTransform3D or RemoteTransform2D copies its own transform onto
 * the node its `remote_path` names on enter-tree (Godot's `_update_remote()`), so a static render
 * shows the target at the relay's transform. It is a description-level effect, not simulation, so
 * ADR-0008 (what a node draws) does not govern it. Semantics are measured on Godot 4.6.3.
 */

import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types.js';
import type { Node3DProperties } from '../../../nodes/base/node3d/types.js';
import type { Node2DProperties, Vector2 } from '../../../nodes/base/node2d/types.js';
import { joinPath, resolveNodePathLiteral } from '../../../utils/nodePath.js';
import { UNIQUE_NODE_PREFIX, isUniqueNameInOwner } from '../../../utils/uniqueNames.js';
import { globalMatrix3D, matrixToTransform3D } from '../../../r3f/nodeTreeTransforms.js';
import {
  TRANSFORM2D_IDENTITY,
  multiplyTransform2D,
  transform2DFromParts,
  type Transform2DColumns,
} from '../../../godot/transform2d.js';

const REMOTE_TRANSFORM_TYPES = new Set(['RemoteTransform3D', 'RemoteTransform2D']);

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
 * Resolve every RemoteTransform in `nodes`, mutating each target's transform in place, and return
 * the same array. It runs once, after parse and before the SceneGraph (`useParsedScene.toParseResult`),
 * so every consumer reads the moved target. The parse is memoized per content, so a re-run is idempotent.
 */
export function applyRemoteTransforms(nodes: TscnNode[]): TscnNode[] {
  const nodeByPath = new Map<string, TscnNode>();
  const relays: Array<{ node: TscnNode; path: string }> = [];

  // `NodePath("%Target")` addresses the owner's claim table, so the table must exist before any
  // relay resolves. This walk collects it, first-one-wins in the same depth-first order, since a
  // second walk rebuilds every path string to keep a few. `utils/uniqueNames` owns the rule and the
  // key spelling, and this module's test pins that both answer alike.
  const uniquePaths = new Map<string, string>();

  const walk = (node: TscnNode, parentPath: string): void => {
    const path = joinPath(parentPath, node.name);
    nodeByPath.set(path, node);
    if (REMOTE_TRANSFORM_TYPES.has(node.type)) relays.push({ node, path });
    if (isUniqueNameInOwner(node)) {
      const key = UNIQUE_NODE_PREFIX + node.name;
      if (!uniquePaths.has(key)) uniquePaths.set(key, path);
    }
    for (const child of node.children) walk(child, path);
  };
  // Only the authored root scene. The live scene tree (ADR-0013) composes instanced sub-scenes
  // later, so a relay inside an instance, or a `remote_path` that crosses one, is not resolved.
  for (const node of nodes) walk(node, '');

  if (relays.length === 0) return nodes;

  // Document (pre-order) order, as Godot's enter-tree order applies a one-direction chain. A relay
  // that drives its own ancestor is not iterated to a fixed point.
  for (const { node, path } of relays) {
    if (node.type === 'RemoteTransform3D') applyRelay3D(node, path, nodeByPath, uniquePaths);
    else applyRelay2D(node, path, nodeByPath, uniquePaths);
  }
  return nodes;
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

function parentPathOf(path: string): string | null {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? null : path.slice(0, idx);
}

function applyRelay3D(
  relay: TscnNode,
  relayPath: string,
  nodeByPath: Map<string, TscnNode>,
  uniquePaths: ReadonlyMap<string, string>
): void {
  const props = relay.properties as RelayProps;
  const targetPath = resolveNodePathLiteral(relayPath, props.remote_path, uniquePaths);
  if (!targetPath) return;
  const target = nodeByPath.get(targetPath);
  if (!target) return;

  const flags = readFlags(props);
  // Local mode leaves the target at its authored transform in a static render (a matched pair,
  // measured). `_update_remote` keys off the relay's transform-changed notification, which the
  // global path satisfies on load and the local path does not.
  if (!flags.useGlobal) return;

  const relayGlobal = globalMatrix3D(relayPath, nodeByPath);
  const targetGlobal = globalMatrix3D(targetPath, nodeByPath);
  const desired = composeSelected3D(targetGlobal, relayGlobal, flags);
  const parentPath = parentPathOf(targetPath);
  const parentGlobal = parentPath
    ? globalMatrix3D(parentPath, nodeByPath)
    : new THREE.Matrix4();
  const newLocal = parentGlobal.clone().invert().multiply(desired);

  (target.properties as Node3DProperties).transform = matrixToTransform3D(newLocal);
}

/**
 * `base` with each flagged component (position, rotation, scale) taken from `source`, composed in
 * global space, as the 2D path is too. This matches Godot exactly when the target's parent has no
 * rotation or scale. Under a rotated or scaled parent, Godot's `set_rotation`/`set_scale` quirk diverges.
 */
function composeSelected3D(
  base: THREE.Matrix4,
  source: THREE.Matrix4,
  flags: RemoteFlags
): THREE.Matrix4 {
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

function applyRelay2D(
  relay: TscnNode,
  relayPath: string,
  nodeByPath: Map<string, TscnNode>,
  uniquePaths: ReadonlyMap<string, string>
): void {
  const props = relay.properties as RelayProps;
  const targetPath = resolveNodePathLiteral(relayPath, props.remote_path, uniquePaths);
  if (!targetPath) return;
  const target = nodeByPath.get(targetPath);
  if (!target) return;

  const flags = readFlags(props);
  // Local mode leaves the target in place, as in `applyRelay3D`.
  if (!flags.useGlobal) return;

  const relayGlobal = globalTransform2D(relayPath, nodeByPath);
  const targetGlobal = globalTransform2D(targetPath, nodeByPath);
  const desired = composeSelected2D(targetGlobal, relayGlobal, flags);
  const parentPath = parentPathOf(targetPath);
  const parentGlobal = parentPath ? globalTransform2D(parentPath, nodeByPath) : TRANSFORM2D_IDENTITY;
  const newLocal = multiplyTransform2D(invertTransform2D(parentGlobal), desired);

  // Godot's RemoteTransform2D pushes position, rotation and scale only. The target keeps its `skew`.
  const dec = decomposeTransform2D(newLocal);
  const tp = target.properties as Node2DProperties;
  tp.position = dec.position;
  tp.rotation = dec.rotation;
  tp.scale = dec.scale;
}

function localTransform2D(node: TscnNode): Transform2DColumns {
  const props = node.properties as Partial<Node2DProperties>;
  if (!props || props.position === undefined) return TRANSFORM2D_IDENTITY;
  return transform2DFromParts(
    props.rotation ?? 0,
    props.scale ?? { x: 1, y: 1 },
    props.skew ?? 0,
    props.position
  );
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

function invertTransform2D(m: Transform2DColumns): Transform2DColumns {
  const det = m.a * m.d - m.b * m.c;
  if (det === 0) return TRANSFORM2D_IDENTITY;
  const inv = 1 / det;
  const a = m.d * inv;
  const b = -m.b * inv;
  const c = -m.c * inv;
  const d = m.a * inv;
  return { a, b, c, d, tx: -(a * m.tx + c * m.ty), ty: -(b * m.tx + d * m.ty) };
}

/** Godot Transform2D decomposition into position, rotation and scale. Skew is dropped. */
function decomposeTransform2D(m: Transform2DColumns): { position: Vector2; rotation: number; scale: Vector2 } {
  const rotation = Math.atan2(m.b, m.a);
  const det = m.a * m.d - m.b * m.c;
  const scaleX = Math.hypot(m.a, m.b);
  const scaleY = (det < 0 ? -1 : 1) * Math.hypot(m.c, m.d);
  return { position: { x: m.tx, y: m.ty }, rotation, scale: { x: scaleX, y: scaleY } };
}
