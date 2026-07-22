/**
 * RemoteTransform resolution pass (Godot `RemoteTransform3D`/`RemoteTransform2D`).
 *
 * A RemoteTransform node copies its OWN transform onto the node its
 * `remote_path` resolves to — Godot's `_update_remote()`. This fires on
 * enter-tree, so in a static render (no game loop) the target already sits at
 * the relay's transform. It is therefore a deterministic, description-level
 * effect over the parsed tree, NOT runtime simulation: it does not conflict
 * with ADR-0008 (which only governs whether a node DRAWS anything — the relay
 * still draws nothing; this pass just resolves where its target ends up).
 *
 * The pass runs ONCE over the whole authored scene tree, right after parse and
 * before the SceneGraph is assembled (see `useParsedScene.toParseResult`), so
 * every downstream consumer — 3D render, 2D world canvas, gizmos, bounds,
 * selection, the tree viewer and the inspector — reads the moved target for
 * free. It mutates the freshly-parsed, not-yet-shared tree in place (the parse
 * is memoized per content, so re-running is idempotent).
 *
 * Semantics reproduced (measured against real Godot 4.6.3 via the ref harness):
 *   - `use_global_coordinates` (default true): the target's GLOBAL transform is
 *     set from the relay's GLOBAL transform, per the enabled update flags. With
 *     all three flags true it is a straight global-transform copy.
 *   - `use_global_coordinates = false`: a NO-OP in a static render. Measured on
 *     a matched pair (same tree, flag the only difference): the global-mode
 *     relay repositions its target, the local-mode one leaves it at its authored
 *     transform. Godot's `_update_remote` keys off the relay's transform-changed
 *     notification, which the global path satisfies on load and the local path
 *     does not — so a static previewer (no game loop moving the relay) only ever
 *     shows the global-coordinate drive. Reproduced, not derived (PARITY-LIMITATIONS.md).
 *   - `update_position`/`update_rotation`/`update_scale` (each default true)
 *     select which components are pushed; disabled components keep the target's.
 *
 * Scope / limits (see docs/PARITY-LIMITATIONS.md):
 *   - The pass sees only the authored root scene. Instanced sub-scenes are
 *     composed later by the live scene tree (ADR-0013), so a `remote_path`
 *     crossing into/out of an instance — or a relay living inside an instanced
 *     sub-scene — is not resolved here.
 *   - A relay whose target is itself a relay resolves in document (pre-order)
 *     order, matching Godot's tree-order enter-tree application for the common
 *     single-direction chain. Feedback loops (a relay driving one of its own
 *     ancestors) are not iterated to a fixed point.
 *   - Partial-flag composition of rotation/scale is done at the global level and
 *     matches Godot exactly when the target's parent carries no rotation/scale
 *     (translation-only) — the case the fixtures exercise. Under a rotated or
 *     scaled parent Godot's own `set_rotation`/`set_scale` quirk diverges.
 */

import * as THREE from 'three';
import type { TscnNode } from '../parser/types.js';
import type { Node3DProperties, Transform3D } from '../nodes/base/node3d/types.js';
import type { Node2DProperties, Vector2 } from '../nodes/base/node2d/types.js';
import { joinPath } from '../utils/nodePath.js';

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
 * Resolve every RemoteTransform in `nodes`, mutating each target's parsed
 * transform in place. Returns the same array for call-site convenience.
 */
export function applyRemoteTransforms(nodes: TscnNode[]): TscnNode[] {
  const nodeByPath = new Map<string, TscnNode>();
  const relays: Array<{ node: TscnNode; path: string }> = [];

  const walk = (node: TscnNode, parentPath: string): void => {
    const path = joinPath(parentPath, node.name);
    nodeByPath.set(path, node);
    if (REMOTE_TRANSFORM_TYPES.has(node.type)) relays.push({ node, path });
    for (const child of node.children) walk(child, path);
  };
  for (const node of nodes) walk(node, '');

  if (relays.length === 0) return nodes;

  for (const { node, path } of relays) {
    if (node.type === 'RemoteTransform3D') applyRelay3D(node, path, nodeByPath);
    else applyRelay2D(node, path, nodeByPath);
  }
  return nodes;
}

// --- Shared helpers -------------------------------------------------------

/** Parse a relay's flags, each defaulting to Godot's `true`. */
function readFlags(props: RelayProps): RemoteFlags {
  return {
    updatePosition: props.update_position !== false,
    updateRotation: props.update_rotation !== false,
    updateScale: props.update_scale !== false,
    useGlobal: props.use_global_coordinates !== false,
  };
}

/** Inner path of a `remote_path` value, or null when it names no target. */
function remoteTargetPath(relayPath: string, raw: string | undefined): string | null {
  if (!raw) return null;
  const match = /NodePath\(\s*"([^"]*)"\s*\)/.exec(raw);
  const inner = (match?.[1] ?? raw).trim();
  if (inner === '' || inner === '.') return null;
  // Absolute paths (`/root/...`) address the live tree, which a static parse
  // does not model — unsupported.
  if (inner.startsWith('/')) return null;
  return resolveRelativePath(relayPath, inner);
}

/**
 * Resolve a NodePath relative to the relay node's own full path.
 * `..` climbs to the parent; named segments descend. Returns null if it
 * climbs past the root.
 */
function resolveRelativePath(basePath: string, relative: string): string | null {
  const segments = basePath.split('/');
  for (const part of relative.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      segments.pop();
      if (segments.length === 0) return null;
      continue;
    }
    segments.push(part);
  }
  return segments.length > 0 ? segments.join('/') : null;
}

function parentPathOf(path: string): string | null {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? null : path.slice(0, idx);
}

// --- 3D -------------------------------------------------------------------

function applyRelay3D(
  relay: TscnNode,
  relayPath: string,
  nodeByPath: Map<string, TscnNode>
): void {
  const props = relay.properties as RelayProps;
  const targetPath = remoteTargetPath(relayPath, props.remote_path);
  if (!targetPath) return;
  const target = nodeByPath.get(targetPath);
  if (!target) return;

  const flags = readFlags(props);
  // Local-coordinate mode does not reposition the target in a static render
  // (measured — see module header). Only the global-coordinate drive applies.
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

/** Local Transform3D of a node as a Matrix4 (identity when absent). */
function localMatrix3D(node: TscnNode): THREE.Matrix4 {
  const t = (node.properties as Node3DProperties).transform;
  return t ? transform3DToMatrix(t) : new THREE.Matrix4();
}

/** Global Matrix4 = root→node product of local matrices. */
function globalMatrix3D(path: string, nodeByPath: Map<string, TscnNode>): THREE.Matrix4 {
  const result = new THREE.Matrix4();
  let acc = '';
  for (const segment of path.split('/')) {
    acc = acc ? `${acc}/${segment}` : segment;
    const node = nodeByPath.get(acc);
    if (node) result.multiply(localMatrix3D(node));
  }
  return result;
}

/**
 * Take `base` and replace its position/rotation/scale with `source`'s per the
 * flags. All-on is a straight copy of `source`; otherwise decompose both and
 * recombine the selected components.
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

/**
 * Godot Transform3D → three Matrix4. Godot stores the Basis as rows
 * (`basis_x`/`basis_y`/`basis_z`), so they land as the matrix's first three
 * rows with `origin` in the translation column. `Matrix4.set` is row-major.
 */
function transform3DToMatrix(t: Transform3D): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    t.basis_x.x, t.basis_x.y, t.basis_x.z, t.origin.x,
    t.basis_y.x, t.basis_y.y, t.basis_y.z, t.origin.y,
    t.basis_z.x, t.basis_z.y, t.basis_z.z, t.origin.z,
    0, 0, 0, 1
  );
}

/** three Matrix4 → Godot Transform3D (inverse of {@link transform3DToMatrix}). */
function matrixToTransform3D(m: THREE.Matrix4): Transform3D {
  const e = m.elements; // column-major: e[col*4 + row]
  return {
    basis_x: { x: e[0]!, y: e[4]!, z: e[8]! },
    basis_y: { x: e[1]!, y: e[5]!, z: e[9]! },
    basis_z: { x: e[2]!, y: e[6]!, z: e[10]! },
    origin: { x: e[12]!, y: e[13]!, z: e[14]! },
  };
}

// --- 2D -------------------------------------------------------------------

/**
 * A Godot Transform2D as its two basis columns + origin:
 * `x' = a·x + c·y + tx`, `y' = b·x + d·y + ty`.
 */
interface Affine2D {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

const IDENTITY_2D: Affine2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

function applyRelay2D(
  relay: TscnNode,
  relayPath: string,
  nodeByPath: Map<string, TscnNode>
): void {
  const props = relay.properties as RelayProps;
  const targetPath = remoteTargetPath(relayPath, props.remote_path);
  if (!targetPath) return;
  const target = nodeByPath.get(targetPath);
  if (!target) return;

  const flags = readFlags(props);
  // Local-coordinate mode does not reposition the target in a static render
  // (measured — see module header). Only the global-coordinate drive applies.
  if (!flags.useGlobal) return;

  const relayGlobal = globalAffine2D(relayPath, nodeByPath);
  const targetGlobal = globalAffine2D(targetPath, nodeByPath);
  const desired = composeSelected2D(targetGlobal, relayGlobal, flags);
  const parentPath = parentPathOf(targetPath);
  const parentGlobal = parentPath ? globalAffine2D(parentPath, nodeByPath) : IDENTITY_2D;
  const newLocal = mulAffine2D(invertAffine2D(parentGlobal), desired);

  // Godot's RemoteTransform2D pushes position/rotation/scale only; the target
  // keeps its own `skew`.
  const dec = decomposeAffine2D(newLocal);
  const tp = target.properties as Node2DProperties;
  tp.position = dec.position;
  tp.rotation = dec.rotation;
  tp.scale = dec.scale;
}

function localAffine2D(node: TscnNode): Affine2D {
  const props = node.properties as Partial<Node2DProperties>;
  if (!props || props.position === undefined) return IDENTITY_2D;
  return trsToAffine2D(
    props.position,
    props.rotation ?? 0,
    props.scale ?? { x: 1, y: 1 },
    props.skew ?? 0
  );
}

function globalAffine2D(path: string, nodeByPath: Map<string, TscnNode>): Affine2D {
  let result = IDENTITY_2D;
  let acc = '';
  for (const segment of path.split('/')) {
    acc = acc ? `${acc}/${segment}` : segment;
    const node = nodeByPath.get(acc);
    if (node) result = mulAffine2D(result, localAffine2D(node));
  }
  return result;
}

function composeSelected2D(base: Affine2D, source: Affine2D, flags: RemoteFlags): Affine2D {
  const b = decomposeAffine2D(base);
  const s = decomposeAffine2D(source);
  return trsToAffine2D(
    flags.updatePosition ? s.position : b.position,
    flags.updateRotation ? s.rotation : b.rotation,
    flags.updateScale ? s.scale : b.scale,
    0
  );
}

/** Godot `Transform2D(rotation, scale, skew, position)` construction. */
function trsToAffine2D(position: Vector2, rotation: number, scale: Vector2, skew: number): Affine2D {
  return {
    a: Math.cos(rotation) * scale.x,
    b: Math.sin(rotation) * scale.x,
    c: -Math.sin(rotation + skew) * scale.y,
    d: Math.cos(rotation + skew) * scale.y,
    tx: position.x,
    ty: position.y,
  };
}

/** m1 · m2 (apply m2 then m1). */
function mulAffine2D(m1: Affine2D, m2: Affine2D): Affine2D {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
    ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty,
  };
}

function invertAffine2D(m: Affine2D): Affine2D {
  const det = m.a * m.d - m.b * m.c;
  if (det === 0) return IDENTITY_2D;
  const inv = 1 / det;
  const a = m.d * inv;
  const b = -m.b * inv;
  const c = -m.c * inv;
  const d = m.a * inv;
  return { a, b, c, d, tx: -(a * m.tx + c * m.ty), ty: -(b * m.tx + d * m.ty) };
}

/** Godot Transform2D decomposition (position/rotation/scale; skew dropped). */
function decomposeAffine2D(m: Affine2D): { position: Vector2; rotation: number; scale: Vector2 } {
  const rotation = Math.atan2(m.b, m.a);
  const det = m.a * m.d - m.b * m.c;
  const scaleX = Math.hypot(m.a, m.b);
  const scaleY = (det < 0 ? -1 : 1) * Math.hypot(m.c, m.d);
  return { position: { x: m.tx, y: m.ty }, rotation, scale: { x: scaleX, y: scaleY } };
}
