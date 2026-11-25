import {
  CANVAS_ITEM_MATERIAL,
  NO_MATERIAL,
  type CanvasItemMaterialSlot,
} from '../../resources/materials/canvasitemmaterial/kind';
import { useNodeReference, useReferencedResource } from '../../resources/reading';
import type { SceneScope } from '../../parser/types';
import type { CanvasAncestorMaterial } from '../canvasItemPass/canvasItemPass';

/** What decides a CanvasItem's material: its own reference, or the ancestor chain's by `use_parent_material`. */
interface CanvasItemMaterialSource {
  /** The raw `material` reference, a SubResource or an ExtResource. */
  readonly ref: string | undefined;
  readonly useParentMaterial: boolean;
}

/** The parent's material by `use_parent_material`, else the item's own (`canvas_item.cpp:1204-1211`). */
export function useResolvedCanvasItemMaterial(
  { ref, useParentMaterial }: CanvasItemMaterialSource,
  scope: SceneScope,
  inherited: CanvasAncestorMaterial
): CanvasItemMaterialSlot {
  const source = useParentMaterial ? ancestorSource(inherited, scope) : { ref, scope };
  const read = useReferencedResource(useNodeReference(source.ref, source.scope), CANVAS_ITEM_MATERIAL);
  return read.status === 'loaded' ? read.value : NO_MATERIAL;
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
