/**
 * BUG 2: apply Godot instance-property overrides onto nodes that live
 * INSIDE an instanced GLB.
 *
 * Godot lets an instancing scene override the transform of a node inside
 * the instanced PackedScene, e.g. `roof_lamp.tscn`:
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
 * Scope: position / rotation / scale only. The override's
 * `surface_material_override/0` is a separate (parser-level) gap not
 * captured by the base `Node` parser, so it is out of scope here.
 */
import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import type { Node3DProperties } from '../../../nodes/base/node3d/types';
import { decomposeForR3F } from '../../nodeTransform';

/**
 * Walk `root`'s descendants and, for every override node that carries a
 * `transform`, overwrite the matching GLB node's local position /
 * rotation / scale. Matches by `name`. Mutates `root` in place (the
 * caller owns a per-consumer clone).
 *
 * Returns the set of override node names that were applied, so the
 * caller can avoid double-rendering them as empty sibling groups.
 */
export function applyGlbNodeOverrides(
  root: THREE.Object3D,
  overrides: readonly TscnNode[]
): Set<string> {
  const applied = new Set<string>();
  if (overrides.length === 0) return applied;

  // Index GLB descendants by name (first match wins, mirroring Godot's
  // index/name addressing for a single matching node).
  const byName = new Map<string, THREE.Object3D>();
  root.traverse((obj) => {
    if (obj === root) return;
    if (obj.name && !byName.has(obj.name)) byName.set(obj.name, obj);
  });
  // The GLB root primitive itself can be the override target when the
  // GLB has a single node whose name matches.
  if (root.name && !byName.has(root.name)) byName.set(root.name, root);

  for (const override of overrides) {
    const transform = (override.properties as Node3DProperties).transform;
    if (!transform) continue;
    const target = byName.get(override.name);
    if (!target) continue;

    const { position, rotation, scale } = decomposeForR3F(transform);
    target.position.set(position[0], position[1], position[2]);
    target.rotation.set(rotation[0], rotation[1], rotation[2]);
    target.scale.set(scale[0], scale[1], scale[2]);
    target.updateMatrix();
    applied.add(override.name);
  }

  return applied;
}
