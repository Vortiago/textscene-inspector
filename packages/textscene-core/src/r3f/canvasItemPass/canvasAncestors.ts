/**
 * The CanvasItem state a chain of skipped ancestors hands an item drawn away from its tree parent:
 * the y-sort lift and the Control walker each draw an item without the groups of the canvas items
 * above it, so each puts back what those items hand down. Visibility stays out: an animation and
 * the editor's eye toggle change it per node at runtime.
 */

import type { SceneScope } from '../../parser/types';
import type { Transform2DColumns } from '../../godot/math/transform2d';
import type { AmbientTextureSampler } from '../canvasItemTextureSampler';
import type { SkippedCanvasItems } from '../canvasItemState';

/**
 * The material of the chain's innermost item, which a `use_parent_material` item below takes: one
 * the chain names, in the scope of the node that names it, none, or the item above the chain's.
 */
export type CanvasAncestorMaterial =
  { kind: 'own'; ref: string; resources: SceneScope } | { kind: 'inherit' } | { kind: 'none' };

/** A chain that defers to the item above it, such as the sort root of a y-sort lift. */
export const INHERIT_PARENT_MATERIAL: CanvasAncestorMaterial = { kind: 'inherit' };
/** A chain that defers to nothing, since its outermost link has no parent item. */
export const NO_PARENT_MATERIAL: CanvasAncestorMaterial = { kind: 'none' };

export interface CanvasAncestors extends SkippedCanvasItems {
  /**
   * Composed `Transform2D`, outermost first (`transform_2d.cpp:198-218`). Never decomposed:
   * composed ancestors can shear, which rotation and scale cannot represent.
   */
  transform: Transform2DColumns;
  /**
   * The `texture_filter` and `texture_repeat` the chain names, the innermost winning
   * (`canvas_item.cpp:1625-1699`). Unnamed where none does, so the ambient above the chain decides.
   */
  sampler: AmbientTextureSampler;
  material: CanvasAncestorMaterial;
}
