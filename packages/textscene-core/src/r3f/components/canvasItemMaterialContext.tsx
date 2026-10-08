/**
 * The resolved `CanvasItemMaterial` for a 2D node. `use_parent_material` walks
 * up the CanvasItem chain, and that walk lives here once, so each slice gets
 * the resolved material. `null` means Godot's plain canvas blending (MIX, lit).
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { canvasItemMaterialOf } from '../../resources/materials/canvasitemmaterial/parser';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import type { ParsedResource } from '../../parser/parsedResource';
import { resolveExtResourcePath, resolveSubResourceRef } from '../../resources/SubResourceResolver';
import { useResource } from '../../resources/useResource';
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
  return <CanvasItemMaterialContext.Provider value={value}>{children}</CanvasItemMaterialContext.Provider>;
}

/** The material inherited from the nearest ancestor that supplies one. */
export function useInheritedCanvasItemMaterial(): CanvasItemMaterialProperties | null {
  return useContext(CanvasItemMaterialContext);
}

/**
 * `use_parent_material` gives the ancestor chain's material, an own
 * `materialPath` gives that resource, a SubResource or a `.tres` file, when it
 * is a CanvasItemMaterial, and neither gives null. Any other material type
 * resolves to null, since invented blend state is worse than Godot's plain default.
 */
export function useCanvasItemMaterial(props: Node2DProperties): CanvasItemMaterialProperties | null {
  const inherited = useInheritedCanvasItemMaterial();
  const { internalResources, externalResources } = useSceneResources();
  const ownRef = props.use_parent_material ? undefined : props.materialPath;
  const sub = useMemo(() => resolveSubResourceRef(ownRef, internalResources), [ownRef, internalResources]);
  const filePath = useMemo(
    () => (sub ? null : resolveExtResourcePath(ownRef, externalResources)),
    [sub, ownRef, externalResources]
  );
  const fromSub = useMemo(() => (sub ? canvasItemMaterialOf(sub) : null), [sub]);
  const fromFile = useCanvasItemMaterialFile(filePath);
  if (props.use_parent_material) return inherited;
  return sub ? fromSub : fromFile;
}

/**
 * The material a `.tres` file holds, as `CanvasItem::set_material` takes any loaded
 * `Ref<Material>` (`scene/main/canvas_item.cpp:1204-1211`). Null for no path, a file still
 * loading or missing, a binary `.res`, which no processor reads, or any other material type.
 */
export function useCanvasItemMaterialFile(path: string | null): CanvasItemMaterialProperties | null {
  const tresPath = path?.endsWith('.tres') ? path : '';
  const { value } = useResource<ParsedResource>(tresPath, 'resource');
  return useMemo(
    () =>
      tresPath && value ? canvasItemMaterialOf({ type: value.resourceType, data: value.properties }) : null,
    [tresPath, value]
  );
}
