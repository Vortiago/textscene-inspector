/**
 * The resolved `CanvasItemMaterial` in force for a 2D node.
 *
 * Godot's `use_parent_material` walks UP the CanvasItem chain until it finds a
 * node that supplies one, so the material a node draws with is a property of
 * its ancestry, not of the node alone. That walk lives here, once, rather than
 * in each of the ten slices that funnel through `<CanvasItem2D>` — a slice
 * receives the already-resolved material and never has to know the rule.
 *
 * `null` means "no material": Godot's plain canvas blending (MIX, lit normally).
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
function useInheritedCanvasItemMaterial(): CanvasItemMaterialProperties | null {
  return useContext(CanvasItemMaterialContext);
}

/**
 * Resolve the material this node draws with:
 *
 *   `use_parent_material`  → whatever the ancestor chain supplies
 *   own `material` ref     → that resource, when it parses as a CanvasItemMaterial
 *   neither                → null
 *
 * A `ShaderMaterial` (or any other material type) resolves to null: it is not
 * implemented, and inventing blend state for it would be worse than Godot's
 * plain default.
 */
export function useCanvasItemMaterial(
  props: Node2DProperties
): CanvasItemMaterialProperties | null {
  const inherited = useInheritedCanvasItemMaterial();
  const { internalResources } = useSceneResources();

  return useMemo(() => {
    if (props.use_parent_material) return inherited;
    const resource = resolveSubResourceRef(props.material, internalResources);
    if (resource?.type !== 'CanvasItemMaterial') return null;
    return parseCanvasItemMaterial(resource.data as Record<string, string>);
  }, [props.use_parent_material, props.material, inherited, internalResources]);
}
