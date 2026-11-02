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
 * One node's material slot or slots. Gated on the slot, not on `isMesh`, because a glTF's
 * non-triangle primitives arrive as `Points`/`Line` with a material the importer's
 * per-surface rules reach too.
 */
function slotsOfNode(node: THREE.Object3D): SurfaceSlot[] {
  const holder = node as THREE.Mesh;
  const slot = holder.material as THREE.Material | THREE.Material[] | undefined;
  if (!slot) return [];
  if (Array.isArray(slot)) {
    return slot.map((material, index) => ({
      holder,
      index,
      count: slot.length,
      material,
      assign: (replacement: THREE.Material) => {
        slot[index] = replacement;
      },
      read: () => slot[index],
    }));
  }
  return [
    {
      holder,
      index: 0,
      count: 1,
      material: slot,
      assign: (replacement: THREE.Material) => {
        holder.material = replacement;
      },
      read: () => holder.material as THREE.Material | undefined,
    },
  ];
}

/** Visit every surface material under `object`, with the setter for its own slot. */
export function forEachSurfaceMaterial(object: THREE.Object3D, visit: SurfaceVisitor): void {
  for (const { material, assign, read } of surfaceSlotsUnder(object)) visit(material, assign, read);
}

/** One surface slot of a glTF asset, with the object that draws it. */
export interface SurfaceSlot {
  /**
   * The object that draws the slot's surface, cast as a Mesh: a glTF's points and line
   * primitives own a slot too. A caller that mounts a sibling draw over the slot's
   * geometry gates on `isMesh` — a Mesh over their vertices would draw triangles.
   */
  holder: THREE.Mesh;
  /** The draw group the surface sits in, over the holder's slot count. */
  index: number;
  count: number;
  /** What the slot holds when the slot is read. */
  material: THREE.Material;
  /** Swaps the slot's material in place, as the visit's setter does. */
  assign(replacement: THREE.Material): void;
  /**
   * Reads what the slot holds later, after other writers may have replaced it, so a
   * restore does not undo a newer writer.
   */
  read(): THREE.Material | undefined;
}

/**
 * Every surface material slot under `object`, with its own holder, in
 * `forEachSurfaceMaterial`'s reach order; a holder with several surfaces appears once
 * per slot. A caller that pairs draws with the slot they cover, instead of visiting the
 * materials, needs this shape.
 */
export function surfaceSlotsUnder(object: THREE.Object3D): SurfaceSlot[] {
  const slots: SurfaceSlot[] = [];
  object.traverse((node) => slots.push(...slotsOfNode(node)));
  return slots;
}
