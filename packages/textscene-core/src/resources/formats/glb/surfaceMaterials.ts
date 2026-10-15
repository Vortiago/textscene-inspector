/**
 * The walk over a glTF asset's surface materials that every per-surface rule shares: the
 * importer's sidecar corrections, the per-consumer clone and its disposal.
 */

import * as THREE from 'three';

/**
 * A material slot visitor: the material, the setter that replaces it in place, and a reader
 * for what the slot holds later, after other writers may have replaced it.
 */
type SurfaceVisitor = (
  material: THREE.Material,
  assign: (replacement: THREE.Material) => void,
  read: () => THREE.Material | undefined
) => void;

/**
 * One node's material slot or slots, the one place that owns the array-or-single branch.
 * Gated on the slot, not on `isMesh`, because a glTF's non-triangle primitives arrive as
 * `Points`/`Line` with a material the importer's per-surface rules reach too.
 */
function visitNodeMaterials(node: THREE.Object3D, visit: SurfaceVisitor): void {
  const holder = node as THREE.Mesh;
  const slot = holder.material as THREE.Material | THREE.Material[] | undefined;
  if (!slot) return;
  if (Array.isArray(slot)) {
    slot.forEach((material, index) => {
      visit(
        material,
        (replacement) => {
          slot[index] = replacement;
        },
        () => slot[index]
      );
    });
  } else {
    visit(
      slot,
      (replacement) => {
        holder.material = replacement;
      },
      () => holder.material as THREE.Material
    );
  }
}

/** Visit every surface material under `object`, with the setter for its own slot. */
export function forEachSurfaceMaterial(object: THREE.Object3D, visit: SurfaceVisitor): void {
  object.traverse((node) => visitNodeMaterials(node, visit));
}
