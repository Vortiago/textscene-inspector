/**
 * The resolved `CanvasItemMaterial` for a 2D node. `use_parent_material` walks
 * up the CanvasItem chain, and that walk lives here once, so each slice gets
 * the resolved material. `null` means Godot's plain canvas blending (MIX, lit).
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { parseCanvasItemMaterial } from '../../resources/materials/canvasitemmaterial/parser';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';
import { resolveSubResourceRef } from '../../resources/SubResourceResolver';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import { useSceneResources } from '../SceneResourcesContext';

const CanvasItemMaterialContext = createContext<CanvasItemMaterialProperties | null>(null);
CanvasItemMaterialContext.displayName = 'CanvasItemMaterialContext';

export function CanvasItemMaterialProvider({
  value,
  children,
}: {
  value: CanvasItemMaterialProperties | null;
  children: ReactNode;
}) {
  return (
    <CanvasItemMaterialContext.Provider value={value}>{children}</CanvasItemMaterialContext.Provider>
  );
}

/** The material inherited from the nearest ancestor that supplies one. */
export function useInheritedCanvasItemMaterial(): CanvasItemMaterialProperties | null {
  return useContext(CanvasItemMaterialContext);
}

/**
 * `use_parent_material` gives the ancestor chain's material, an own
 * `materialPath` gives that resource when it parses as a CanvasItemMaterial,
 * and neither gives null. Any other material type resolves to null, since
 * invented blend state is worse than Godot's plain default.
 */
export function useCanvasItemMaterial(
  props: Node2DProperties
): CanvasItemMaterialProperties | null {
  const inherited = useInheritedCanvasItemMaterial();
  const { internalResources } = useSceneResources();

  return useMemo(() => {
    if (props.use_parent_material) return inherited;
    const resource = resolveSubResourceRef(props.materialPath, internalResources);
    if (resource?.type !== 'CanvasItemMaterial') return null;
    return parseCanvasItemMaterial(resource.data as Record<string, string>);
  }, [props.use_parent_material, props.materialPath, inherited, internalResources]);
}
