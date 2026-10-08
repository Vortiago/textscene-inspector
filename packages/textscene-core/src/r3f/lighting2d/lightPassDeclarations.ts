/**
 * The declaring side of the 2D light pass: what a light, a lit item and a light mesh say about
 * themselves. Each declaration is an effect or a ref: it unwinds on unmount, and a provider
 * `setState` from a child's render is an update during render.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type * as THREE from 'three';
import { LIGHT_PASS_LAYER } from './lightPassLayers.js';
import type { CanvasLightDeclaration, ItemPlacement, PassMeshRole } from './itemLightList.js';
import { useCanvasLighting2D } from './lightPassContext.js';

/**
 * Declares a light while `enabled` holds, until a value changes or unmount. It depends on the
 * values, not the object a light rebuilds each render, which would hand it a new ordinal. Returns
 * the ordinal, or null while the light is undeclared.
 */
export function useRegisterCanvasLight2D(
  enabled: boolean,
  declaration: CanvasLightDeclaration
): number | null {
  const { registerLight } = useCanvasLighting2D();
  const [ordinal, setOrdinal] = useState<number | null>(null);
  const { itemCullMask, zMin, zMax, layerMin, layerMax } = declaration.reach;
  const { sequence, shadowItemCullMask, tintsShadow } = declaration;
  useEffect(() => {
    if (!enabled) {
      setOrdinal(null);
      return undefined;
    }
    const slot = registerLight({
      reach: { itemCullMask, zMin, zMax, layerMin, layerMax },
      sequence,
      shadowItemCullMask,
      tintsShadow,
    });
    setOrdinal(slot.ordinal);
    return slot.release;
  }, [
    enabled,
    registerLight,
    itemCullMask,
    zMin,
    zMax,
    layerMin,
    layerMax,
    sequence,
    shadowItemCullMask,
    tintsShadow,
  ]);
  return ordinal;
}

/**
 * Declares a lit item at `placement`, by value. A Light Only item asks for the unmodulated buffer.
 * The cap hands `positionalLights` as a new array only when they change, so its identity serves.
 */
export function useRegisterLitItem(placement: ItemPlacement, lightOnly: boolean): void {
  const { registerItem } = useCanvasLighting2D();
  const { lightMask, z, layer, positionalLights } = placement;
  useEffect(
    () => registerItem({ lightMask, z, layer, positionalLights }, lightOnly),
    [registerItem, lightMask, z, layer, positionalLights, lightOnly]
  );
}

/**
 * Hands the per-item cap an item at `placement`, uncapped, whose own geometry `geometry` holds.
 * `take` receives the positional lights the item takes while its placement is crowded.
 */
export function useCapItemLights(
  placement: ItemPlacement,
  geometry: RefObject<THREE.Object3D | null>,
  take: (positionalLights: readonly number[] | null) => void
): void {
  const { registerCappedItem } = useCanvasLighting2D();
  const { lightMask, z, layer } = placement;
  useEffect(
    () => registerCappedItem({ placement: { lightMask, z, layer, positionalLights: null }, geometry, take }),
    [registerCappedItem, lightMask, z, layer, geometry, take]
  );
}

/**
 * A callback ref that hands one of light `ordinal`'s meshes to the pass as `role`. The mesh moves
 * onto the light pass layer, which the main render never draws, and stays hidden until a pass
 * shows it: a mesh the pass does not hold would otherwise draw into every list. `onMesh` receives
 * the mesh, and null on unmount.
 */
export function usePassMeshRef<T extends THREE.Object3D>(
  ordinal: number | null,
  role: PassMeshRole,
  onMesh?: (mesh: T | null) => void
): (mesh: T | null) => void {
  const { registerPassMesh } = useCanvasLighting2D();
  const held = useRef<{ mesh: T; release: () => void } | null>(null);
  return useCallback(
    (mesh: T | null) => {
      if (held.current) {
        held.current.release();
        held.current.mesh.visible = false;
        held.current = null;
      }
      if (mesh) {
        mesh.layers.set(LIGHT_PASS_LAYER);
        mesh.visible = false;
        if (ordinal !== null) held.current = { mesh, release: registerPassMesh(mesh, ordinal, role) };
      }
      onMesh?.(mesh);
    },
    [registerPassMesh, ordinal, role, onMesh]
  );
}
