/**
 * The resolved `CanvasItemMaterial` for a 2D node. The canvas item pass walks the
 * `use_parent_material` chain, and this resolves the reference it hands down, so each slice gets
 * the resolved material. `null` means Godot's plain canvas blending (MIX, lit).
 */

import { useMemo } from 'react';
import { canvasItemMaterialOf } from '../../resources/materials/canvasitemmaterial/parser';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';
import type { ParsedResource } from '../../parser/parsedResource';
import {
  isResourceFilePath,
  resolveExtResourcePath,
  resolveSubResourceRef,
} from '../../resources/SubResourceResolver';
import { useResource } from '../../resources/useResource';
import type { SceneScope } from '../../parser/types';
import type { CanvasAncestorMaterial } from '../canvasItemPass/canvasItemPass';

/** What decides a CanvasItem's material: its own reference, or the ancestor chain's by `use_parent_material`. */
interface CanvasItemMaterialSource {
  /** The raw `material` reference, a SubResource or an ExtResource. */
  readonly ref: string | undefined;
  readonly useParentMaterial: boolean;
}

/**
 * `use_parent_material` gives the material the parent item hands down, an own `materialPath` gives
 * that resource, a SubResource or a `.tres` file, when it is a CanvasItemMaterial, and neither gives
 * null. Any other material type resolves to null, since invented blend state is worse than Godot's
 * plain default. The reference resolves in `scope`, below a parent item that hands down `inherited`.
 */
export function useResolvedCanvasItemMaterial(
  { ref, useParentMaterial }: CanvasItemMaterialSource,
  scope: SceneScope,
  inherited: CanvasAncestorMaterial
): CanvasItemMaterialProperties | null {
  const source = useParentMaterial ? ancestorSource(inherited, scope) : { ref, scope };
  return useReferencedCanvasItemMaterial(source.ref, source.scope);
}

/** The reference a parent hands down, in the scope of the item that names it, or none. */
function ancestorSource(
  material: CanvasAncestorMaterial,
  scope: SceneScope
): { ref: string | undefined; scope: SceneScope } {
  return material.kind === 'own'
    ? { ref: material.ref, scope: material.resources }
    : { ref: undefined, scope };
}

/** The CanvasItemMaterial `ref` names in `scope`, or null for no reference or another type. */
function useReferencedCanvasItemMaterial(
  ref: string | undefined,
  { internalResources, externalResources }: SceneScope
): CanvasItemMaterialProperties | null {
  const sub = useMemo(() => resolveSubResourceRef(ref, internalResources), [ref, internalResources]);
  const filePath = useMemo(
    () => (sub ? null : resolveExtResourcePath(ref, externalResources)),
    [sub, ref, externalResources]
  );
  const fromSub = useMemo(() => (sub ? canvasItemMaterialOf(sub) : null), [sub]);
  const fromFile = useCanvasItemMaterialFile(filePath);
  return sub ? fromSub : fromFile;
}

/**
 * The material a resource file holds, as `CanvasItem::set_material` takes any loaded
 * `Ref<Material>` (`scene/main/canvas_item.cpp:1204-1211`). Null for no path, a file still
 * loading or missing, a path no resource file has, or any other material type.
 */
export function useCanvasItemMaterialFile(path: string | null): CanvasItemMaterialProperties | null {
  const resourcePath = path && isResourceFilePath(path) ? path : '';
  const { value } = useResource<ParsedResource>(resourcePath, 'resource');
  return useMemo(
    () =>
      resourcePath && value
        ? canvasItemMaterialOf({ type: value.resourceType, data: value.properties })
        : null,
    [resourcePath, value]
  );
}
