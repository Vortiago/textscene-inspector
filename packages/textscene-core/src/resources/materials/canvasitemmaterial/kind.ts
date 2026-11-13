/**
 * The `CANVAS_ITEM_MATERIAL` kind: a Material slot of a canvas item, from a scene or from a file.
 * A CanvasItemMaterial decodes to its properties, and any other Material to null properties, which
 * draw with plain canvas blending. No THREE.
 */

import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import type { ResourceKind } from '../../reading';
import { canvasItemMaterialOf } from './decode';
import type { CanvasItemMaterialProperties } from './types';

/** A canvas item's material. Null properties for a Material that is no CanvasItemMaterial. */
export interface CanvasItemMaterialSlot {
  readonly properties: CanvasItemMaterialProperties | null;
}

export const CANVAS_ITEM_MATERIAL: ResourceKind<CanvasItemMaterialSlot> = {
  name: 'CanvasItemMaterial',
  accepts: (type) => descendsFromClass(type, 'Material'),
  decode: ({ type, properties }) => ({ properties: canvasItemMaterialOf({ type, data: { ...properties } }) }),
};
