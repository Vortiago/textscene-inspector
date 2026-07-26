/**
 * Apply an **Import sidecar**'s root scale to a freshly loaded source asset (ADR-0027).
 *
 * Godot's importer bakes this before a game ever sees the scene; we re-derive it at load
 * time, so this runs once per asset inside the resource processor rather than per
 * consumer — every downstream reader (render, bounds, selection, the scene tree) sees
 * one corrected object.
 */

import type * as THREE from 'three';

/**
 * `bake` mirrors Godot's `nodes/apply_root_scale`, and the difference is observable.
 *
 * TRUE applies the scale to the asset's own content and leaves the root node at 1, so
 * anything a `.tscn` later parents to the instanced root is NOT scaled. The truck town's
 * tree is exactly this case: `scene.gltf.import` bakes 0.01, and the scene parents a
 * `StaticBody3D/CollisionShape3D` to the tree whose capsule is authored against the
 * final ~9-unit tree. Setting `root.scale` instead would drag that collision shape down
 * with it by 100x.
 *
 * FALSE multiplies the root node's scale, which does carry to those later children —
 * which is equally what Godot does in that mode.
 */
export function applyRootScale(
  root: THREE.Object3D,
  rootScale: { scale: number; bake: boolean } | null
): void {
  if (!rootScale) return;
  const { scale, bake } = rootScale;

  if (!bake) {
    root.scale.multiplyScalar(scale);
    return;
  }

  // Scaling every direct child's local transform is equivalent to scaling the whole
  // subtree, which is what baking into the meshes achieves — and it scales OFFSETS as
  // well as sizes, so a multi-part asset shrinks as one piece instead of flying apart.
  //
  // Known limit: Godot also scales ANIMATION position tracks when it bakes, and this
  // does not. An asset with both a non-identity root scale and animated positions would
  // play its animation at the unscaled amplitude. No corpus asset has both — the tree is
  // the only non-identity scale and it is static — so this is recorded rather than
  // solved, and `scripts/import-sidecar-allowlist.test.mjs` is what would surface a
  // second such asset arriving.
  for (const child of root.children) {
    child.position.multiplyScalar(scale);
    child.scale.multiplyScalar(scale);
  }
}
