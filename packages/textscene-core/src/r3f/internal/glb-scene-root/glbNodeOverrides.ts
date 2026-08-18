/**
 * BUG 2: apply Godot instance-property overrides onto nodes that live
 * INSIDE an instanced GLB.
 *
 * Godot lets an instancing scene override the transform of a node inside
 * the instanced PackedScene, e.g. `ceiling_lamp.tscn`:
 *
 *   [node name="plafoniera" parent="." index="0"]
 *   transform = Transform3D(0.18924935, …, origin 0, 0, 0)
 *
 * This OVERRIDES the GLB's internal `plafoniera` node — keeping the
 * 0.189 scale but resetting its translation to (0,0,0). The renderer
 * mounts the GLB as one opaque `<primitive>`, so without this fix the
 * GLB node's large baked translation `(1.11, -9.73, -9.73)` survived and
 * the lamp mesh floated ~13.8 units from where Godot (and its
 * co-located OmniLight3D) places it.
 *
 * We match each override child to a GLB internal node BY NAME and
 * overwrite its local TRS from the parsed override `transform`. We do
 * NOT zero translations globally — GLBs with no `.tscn` override keep
 * their baked offsets. The fix is driven purely by the presence of an
 * override node from the instancing scene.
 *
 * Scope: position / rotation / scale, plus `layers` and `visible`. A node
 * addressed INTO the GLB (carrying `instanceSubPath`) resolves through
 * `matchGlbTarget`, because Godot's importer and three's do not agree on the
 * node list; a shallow by-name override keeps the flat lookup it always had.
 *
 * `surface_material_override/0` is NOT applied here and cannot be: it needs an
 * ExtResource resolved against the outer scene and an async material load,
 * neither of which a pure synchronous mutation has access to. It rides a
 * portalled component instead — see `GlbSurfaceMaterialOverride`.
 */
import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import type { Node3DProperties } from '../../../nodes/base/node3d/types';
import { decomposeForR3F } from '../../nodeTransform';
import { parseOptionalInt } from '../../../parser/valueParsers';
import { stampVisualLayers } from '../../visualLayers';
import { joinPath } from '../../../utils/nodePath';
import { flattenGlbObjects, type GlbObjectEntry } from './glbHierarchy.js';
import { matchGlbTarget } from './matchGlbTarget.js';

/**
 * Walk `root`'s descendants and, for every override node that carries a
 * `transform`, overwrite the matching GLB node's local position /
 * rotation / scale. Matches by `name`. Mutates `root` in place (the
 * caller owns a per-consumer clone).
 *
 * Returns the set of override node names that were applied, so the
 * caller can avoid double-rendering them as empty sibling groups.
 */
/**
 * The GLB object an override node names, or `undefined` when the graph has
 * nothing that could be it.
 *
 * ONE rule, shared by every consumer of the override list: the transform/layers
 * writer here and the material-slot host in `Component.tsx` must agree about
 * which object an override addresses, or a single authored node silently means
 * two different things.
 *
 * A DEEP override (one whose authored path descended into the instance) resolves
 * through `matchGlbTarget`, because Godot's importer and three's do not agree on
 * the node list. A SHALLOW one keeps the flat first-wins name lookup it has
 * always had, including the GLB root itself — a single-node GLB is legitimately
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
  const byName = entries.find((e) => e.object.name === override.name)?.object;
  return byName ?? (root.name === override.name ? root : undefined);
}

/**
 * Whether an override node is one this function can apply at all — i.e. Godot
 * wrote it WITHOUT `type=`. A typed node at a deep path is a new node belonging
 * inside the instanced content, not properties for whatever is already there,
 * and applying its transform to the object its path resolves to is destructive.
 */
export function isApplicableGlbOverride(override: TscnNode): boolean {
  return !override.instanceSubPath || override.overridesExistingNode === true;
}

export function applyGlbNodeOverrides(
  root: THREE.Object3D,
  overrides: readonly TscnNode[],
  entries: readonly GlbObjectEntry[] = flattenGlbObjects(root)
): Set<string> {
  const applied = new Set<string>();
  if (overrides.length === 0) return applied;

  for (const override of overrides) {
    // The platformer's `CoinCount` Label3D aliases to `Skeleton`; applying it
    // would write its 3.33x scale and 7.5-unit offset onto the whole robot.
    if (!isApplicableGlbOverride(override)) continue;

    const layers = parseOptionalInt(override.rawProperties?.layers, 'uint32');
    const visible = override.rawProperties?.visible;
    const transform = (override.properties as Node3DProperties).transform;
    // Nothing to write means nothing to resolve. The town's four terrain
    // overrides carry only `surface_material_override/0`, which the material
    // slot applies, so they bail here rather than paying for a path match.
    if (layers === undefined && visible === undefined && !transform) continue;

    const target = resolveGlbOverrideTarget(root, entries, override);
    if (!target) continue;

    // `layers` is a VisualInstance3D property, and an override node is
    // TYPE-LESS, so the typed `properties` never carries it — `rawProperties`
    // is where it lands. Stamped over the whole matched subtree because one
    // glTF node with several primitives becomes a Group of Meshes in three,
    // and the mask is read per mesh with no inheritance.
    if (layers !== undefined) stampVisualLayers(target, layers);
    if (visible !== undefined) target.visible = visible !== 'false';
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
