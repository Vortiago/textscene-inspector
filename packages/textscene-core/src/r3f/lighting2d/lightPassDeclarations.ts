/**
 * The declaring side of the 2D light pass: what a light, a lit item and a light mesh say about
 * themselves. Each declaration is an effect or a ref: it unwinds on unmount, and a provider
 * `setState` from a child's render is an update during render.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const { shadowItemCullMask, tintsShadow } = declaration;
  useEffect(() => {
    if (!enabled) {
      setOrdinal(null);
      return undefined;
    }
    const slot = registerLight({
      reach: { itemCullMask, zMin, zMax, layerMin, layerMax },
      shadowItemCullMask,
      tintsShadow,
    });
    setOrdinal(slot.ordinal);
    return slot.release;
  }, [enabled, registerLight, itemCullMask, zMin, zMax, layerMin, layerMax, shadowItemCullMask, tintsShadow]);
  return ordinal;
}

/** Declares a lit item at `placement`, by value. A Light Only item asks for the unmodulated buffer. */
export function useRegisterLitItem(placement: ItemPlacement, lightOnly: boolean): void {
  const { registerItem } = useCanvasLighting2D();
  const { lightMask, z, layer } = placement;
  useEffect(
    () => registerItem({ lightMask, z, layer }, lightOnly),
    [registerItem, lightMask, z, layer, lightOnly]
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
