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
import { flattenGlbObjects, glbObjectName, type GlbObjectEntry } from './glbHierarchy.js';
import { findGlbTarget, matchGlbTarget } from './matchGlbTarget.js';
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

/** Finds the GLB object a Godot path names: `matchGlbTarget`, which logs how, or a quiet lookup. */
type GlbTargetLookup = (entries: readonly GlbObjectEntry[], godotPath: string) => GlbObjectEntry | null;

/**
 * The GLB object a typed node of the instancing scene is added to: the one its parent path names,
 * as Godot adds it (`packed_scene.cpp:157-165`, `:541`). Null for an override, which names an
 * existing node, and for a path that names no object.
 */
export function glbAttachTarget(
  entries: readonly GlbObjectEntry[],
  child: TscnNode,
  lookup: GlbTargetLookup
): GlbObjectEntry | null {
  return isApplicableGlbOverride(child) ? null : lookup(entries, child.instanceSubPath!);
}

/**
 * The instancing scene's typed nodes that {@link glbAttachTarget} places on a GLB object, and the
 * rest of `children`. A typed node whose path names none stays among the rest, where the tree has
 * always listed it. It looks up through the quiet `findGlbTarget`.
 *
 * Each attached node comes back with `glbTargetRelPath` set, so the tree's next step
 * (`glbSceneRootChildren`) finds its row by that key and matches nothing again.
 */
export function splitAttachedChildren(
  root: THREE.Object3D,
  children: readonly LiveNode[]
): { attached: LiveNode[]; rest: LiveNode[] } {
  if (children.every(isApplicableGlbOverride)) return { attached: [], rest: [...children] };
  const entries = flattenGlbObjects(root);
  const attached: LiveNode[] = [];
  const rest: LiveNode[] = [];
  for (const child of children) {
    const entry = glbAttachTarget(entries, child, (all, path) => findGlbTarget(all, path).entry);
    if (entry) attached.push({ ...child, glbTargetRelPath: entry.relPath });
    else rest.push(child);
  }
  return { attached, rest };
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
