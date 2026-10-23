/**
 * Applies an instancing scene's overrides, such as `[node name="plafoniera" parent="."]`, to
 * nodes inside the GLB it instances: transform, `layers` and `visible`. A GLB with no override
 * keeps its baked offsets. `surface_material_override/0` needs an async load, so
 * `GlbSurfaceMaterialOverride` applies it. The scene cull applies the GeometryInstance3D state
 * (`glbGeometryInstances.ts`).
 */
import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import type { LiveNode } from '../../../resources/liveNode';
import type { Node3DProperties } from '../../../nodes/base/node3d/types';
import { decomposeForR3F } from '../../nodeTransform';
import { parseOptionalInt } from '../../../parser/valueParsers';
import { stampMeshInstanceLayers } from '../../../resources/formats/glb/meshInstances';
import { joinPath } from '../../../utils/nodePath';
import { perObject } from '../../../utils/perObject';
import { flattenGlbObjects, glbObjectName, type GlbObjectEntry } from './glbHierarchy.js';
import { findGlbTarget, matchGlbTarget, type GlbTargetMatchKind } from './matchGlbTarget.js';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';

/**
 * The GLB object an override names, or `undefined` when nothing could be it. Both the writer here
 * and the material slots in `Component.tsx` use it, so one node never means two objects. A
 * shallow override takes the first name match, the root included, since a single-node GLB is
 * addressed by its root's name.
 */
export function resolveGlbOverrideTarget(
  root: THREE.Object3D,
  entries: readonly GlbObjectEntry[],
  override: TscnNode
): THREE.Object3D | undefined {
  if (override.instanceSubPath) {
    return matchGlbTarget(entries, joinPath(override.instanceSubPath, override.name))?.object;
  }
  const byName = entries.find((e) => glbObjectName(e.object) === override.name)?.object;
  return byName ?? (glbObjectName(root) === override.name ? root : undefined);
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

/** The lookup result of an override, which attaches to no object. */
const NO_TARGET = { entry: null, kind: 'none' } as const;

/**
 * A typed node of the instancing scene, with the index of the entry of the GLB object it is added
 * to, and how its path matched that entry.
 */
export interface GlbAttachment {
  node: LiveNode;
  target: number;
  match: GlbTargetMatchKind;
}

/**
 * Each of `nodes` that {@link glbAttachPath} places on one of `entries`, with that entry's index, in
 * authored order, and the rest of `nodes`. A typed node whose path names none stays among the rest.
 * Both the scene tree and the viewport resolve through here, so one node never lands on two objects.
 * It looks up through the quiet `findGlbTarget`, and the caller reports what stays unplaced.
 */
export function resolveGlbAttachments(
  entries: readonly GlbObjectEntry[],
  nodes: readonly LiveNode[]
): { attached: GlbAttachment[]; rest: LiveNode[] } {
  const attached: GlbAttachment[] = [];
  const rest: LiveNode[] = [];
  for (const node of nodes) {
    const path = glbAttachPath(node);
    const { entry, kind } = path === null ? NO_TARGET : findGlbTarget(entries, path);
    // `indexOf` costs one more pass of the scan `findGlbTarget` has made, for a node that attaches.
    if (entry) attached.push({ node, target: entries.indexOf(entry), match: kind });
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
  if (overrides.length === 0) return applied;

  for (const override of overrides) {
    if (!isApplicableGlbOverride(override)) continue;

    const layers = parseOptionalInt(override.rawProperties.layers, 'uint32');
    const visible = override.rawProperties.visible;
    const transform = (override.properties as Node3DProperties).transform;
    // Nothing to write means nothing to resolve: an override with only
    // `surface_material_override/0` skips the path match.
    if (layers === undefined && visible === undefined && !transform) continue;

    const target = resolveGlbOverrideTarget(root, entries, override);
    if (!target) continue;

    // An override node has no type, so `layers` lands in `rawProperties`.
    if (layers !== undefined) stampMeshInstanceLayers(target, layers);
    if (visible !== undefined) target.visible = boolSlotValue(visible) !== false;
    if (!transform) continue;

    const { position, rotation, scale } = decomposeForR3F(transform);
    target.position.set(position[0], position[1], position[2]);
    target.rotation.set(rotation[0], rotation[1], rotation[2]);
    target.scale.set(scale[0], scale[1], scale[2]);
    target.updateMatrix();
    applied.add(override.name);
  }

  return applied;
}
