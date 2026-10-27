/**
 * Applies an instancing scene's overrides, such as `[node name="plafoniera" parent="."]`, to
 * nodes inside the GLB it instances: transform, `layers` and `visible`. A Skeleton3D or
 * BoneAttachment3D takes its own properties (`glbFrameOverrides.ts`). A GLB with no override
 * keeps its baked offsets. `surface_material_override/0` needs an async load, so
 * `GlbSurfaceMaterialOverride` applies it. The scene cull applies the GeometryInstance3D state
 * (`glbGeometryInstances.ts`).
 */
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import type { LiveNode } from '../../../resources/liveNode';
import type { Node3DProperties } from '../../../nodes/base/node3d/types';
import { decomposeForR3F } from '../../nodeTransform';
import { parseOptionalInt } from '../../../parser/valueParsers';
import { stampMeshInstanceLayers } from '../../../resources/formats/glb/meshInstances';
import { joinPath } from '../../../utils/nodePath';
import { perObject } from '../../../utils/perObject';
import { flattenGlbObjects, glbObjectName, type GlbObjectEntry } from './glbHierarchy.js';
import { applyGlbFrameOverride } from './glbFrameOverrides.js';
import { writeNodeTransform } from './glbNodeTransform.js';
import { findGlbFrame, findGlbNode, findGlbTarget, matchGlbNode } from './glbPathLookup.js';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';

/** The Godot path below the GLB root of the node an override names. */
function glbOverridePath(override: TscnNode): string {
  return joinPath(override.instanceSubPath ?? '', override.name);
}

/**
 * The GLB object an override names, or `undefined` when nothing could be it. Both the writer here
 * and the material slots in `Component.tsx` use it, so one node never means two objects. A
 * shallow override names a child of the GLB root, or the root itself, since a single-node GLB is
 * addressed by its root's name.
 */
export function resolveGlbOverrideTarget(
  root: THREE.Object3D,
  entries: readonly GlbObjectEntry[],
  override: TscnNode
): THREE.Object3D | undefined {
  const path = glbOverridePath(override);
  if (override.instanceSubPath || glbObjectName(root) !== override.name) {
    return matchGlbNode(entries, path)?.object;
  }
  return findGlbNode(entries, path)?.object ?? root;
}

/**
 * Whether Godot wrote the override without `type=`. A typed node at a deep path is a new node
 * inside the instanced content, and applying its transform to the object its path resolves to is
 * destructive.
 */
export function isApplicableGlbOverride(override: TscnNode): boolean {
  return !override.instanceSubPath || override.overridesExistingNode === true;
}

/**
 * `children` with each node written below a property override lifted to the instance, as the
 * node its parent path names, which is how Godot adds it. The scene tree builder nests such a node
 * below the override heading that its parent path passes through, where only the instance
 * itself can reach the GLB. Every reader of a GLB instance's children asks through here.
 */
export function liftOverrideChildren(children: readonly LiveNode[]): readonly LiveNode[] {
  return children.some((child) => child.overridesExistingNode) ? liftedTopLevel(children) : children;
}

/** Built once for each list, so each reader asking about one list gets one answer. */
const liftedTopLevel = perObject((children: readonly LiveNode[]) => liftBelow(children, undefined));

/**
 * `anchor` is the sub-path of the override the children are written below, undefined at the top.
 * A node below an override has no sub-path of its own, and an empty one means the same.
 */
function liftBelow(children: readonly LiveNode[], anchor: string | undefined): LiveNode[] {
  return children.flatMap((child) => {
    const placed =
      anchor === undefined || child.instanceSubPath ? child : { ...child, instanceSubPath: anchor };
    if (!placed.overridesExistingNode || placed.children.length === 0) return [placed];
    const below = liftBelow(placed.children, joinPath(placed.instanceSubPath ?? '', placed.name));
    return [{ ...placed, children: [] }, ...below];
  });
}

/** {@link liftOverrideChildren}, with the override nodes themselves dropped: Godot adds none. */
export function liftedWithoutOverrides(children: readonly LiveNode[]): LiveNode[] {
  return liftOverrideChildren(children).filter((child) => !child.overridesExistingNode);
}

/**
 * The Godot path of the GLB object a typed node of the instancing scene is added to: its parent
 * path, as Godot adds it (`packed_scene.cpp:157-165`, `:541`). Null for an override, which names
 * an existing node. Each caller resolves the path with its own lookup.
 */
function glbAttachPath(child: TscnNode): string | null {
  return isApplicableGlbOverride(child) ? null : child.instanceSubPath!;
}

/**
 * A typed node of the instancing scene, with the index of the entry of the GLB object it is placed
 * by, and the object it is added to.
 */
export interface GlbAttachment {
  node: LiveNode;
  target: number;
  host: THREE.Object3D;
}

/**
 * Each of `nodes` that {@link glbAttachPath} places on one of `entries`, with that entry's index, in
 * authored order, and the rest of `nodes`. A typed node whose path names none stays among the rest.
 * Both the scene tree and the viewport resolve through here, so one node never lands on two objects.
 * It looks up through the quiet `findGlbTarget`, and the caller reports what stays unplaced.
 *
 * @oneWay Where a node under a GLB instance attaches
 *   The scene tree and the viewport both call it.
 */
export function resolveGlbAttachments(
  entries: readonly GlbObjectEntry[],
  nodes: readonly LiveNode[]
): { attached: GlbAttachment[]; rest: LiveNode[] } {
  const attached: GlbAttachment[] = [];
  const rest: LiveNode[] = [];
  for (const node of nodes) {
    const path = glbAttachPath(node);
    const target = path === null ? null : findGlbTarget(entries, path);
    if (target) attached.push({ node, target: target.entry.index, host: target.host });
    else rest.push(node);
  }
  return { attached, rest };
}

/**
 * {@link resolveGlbAttachments} for the scene tree, over the instancing node's `children`. A
 * property override is no node: Godot takes the existing node by name and adds none
 * (`packed_scene.cpp:280-283`), so it is in neither list.
 *
 * Each attached node comes back with `glbTargetRelPath` set, so the tree's next step
 * (`glbSceneRootChildren`) finds its row by that key and matches nothing again.
 */
export function splitAttachedChildren(
  root: THREE.Object3D,
  children: readonly LiveNode[]
): { attached: LiveNode[]; rest: LiveNode[] } {
  const nodes = liftedWithoutOverrides(children);
  if (nodes.every(isApplicableGlbOverride)) return { attached: [], rest: nodes };
  const entries = flattenGlbObjects(root);
  const { attached, rest } = resolveGlbAttachments(entries, nodes);
  return {
    attached: attached.map(({ node, target }) => ({ ...node, glbTargetRelPath: entries[target]!.relPath })),
    rest,
  };
}

/**
 * Mutates `root`, a per-consumer clone, in place. Returns the names of the applied overrides, so
 * the caller does not render them again as empty sibling groups.
 */
export function applyGlbNodeOverrides(
  root: THREE.Object3D,
  overrides: readonly TscnNode[],
  entries: readonly GlbObjectEntry[] = flattenGlbObjects(root)
): Set<string> {
  const applied = new Set<string>();
  for (const override of overrides) {
    if (!isApplicableGlbOverride(override)) continue;
    const frame = findGlbFrame(entries, glbOverridePath(override));
    const wroteTransform = frame
      ? applyGlbFrameOverride(entries, frame, override)
      : applyToNode(root, entries, override);
    if (wroteTransform) applied.add(override.name);
  }
  return applied;
}

/** Writes `layers`, `visible` and `transform` of `override` on its node, and returns whether it wrote the transform. */
function applyToNode(root: THREE.Object3D, entries: readonly GlbObjectEntry[], override: TscnNode): boolean {
  const layers = parseOptionalInt(override.rawProperties.layers, 'uint32');
  const visible = override.rawProperties.visible;
  const transform = (override.properties as Node3DProperties).transform;
  // Nothing to write means nothing to resolve: an override with only
  // `surface_material_override/0` skips the path match.
  if (layers === undefined && visible === undefined && !transform) return false;

  const target = resolveGlbOverrideTarget(root, entries, override);
  if (!target) return false;

  // An override node has no type, so `layers` lands in `rawProperties`.
  if (layers !== undefined) stampMeshInstanceLayers(target, layers);
  if (visible !== undefined) target.visible = boolSlotValue(visible) !== false;
  if (!transform) return false;

  writeNodeTransform(target, decomposeForR3F(transform));
  return true;
}

/** The objects the overrides with `visible = false` hide: the node each names. A frame is {@link hiddenGlbFramePaths}. The caller owns the result. */
export function hiddenGlbObjects(
  root: THREE.Object3D,
  entries: readonly GlbObjectEntry[],
  overrides: readonly TscnNode[]
): Set<THREE.Object3D> {
  const hidden = new Set<THREE.Object3D>();
  for (const override of hiddenOverrides(overrides)) {
    if (findGlbFrame(entries, glbOverridePath(override))) continue;
    const object = resolveGlbOverrideTarget(root, entries, override);
    if (object) hidden.add(object);
  }
  return hidden;
}

/** The paths of the Skeleton3D and BoneAttachment3D nodes that the overrides with `visible = false` hide. */
export function hiddenGlbFramePaths(
  entries: readonly GlbObjectEntry[],
  overrides: readonly TscnNode[]
): Set<string> {
  const hidden = new Set<string>();
  for (const override of hiddenOverrides(overrides)) {
    const frame = findGlbFrame(entries, glbOverridePath(override));
    if (frame) hidden.add(frame.path);
  }
  return hidden;
}

function hiddenOverrides(overrides: readonly TscnNode[]): TscnNode[] {
  return overrides.filter(
    (override) => boolSlotValue(override.rawProperties.visible) === false && isApplicableGlbOverride(override)
  );
}
