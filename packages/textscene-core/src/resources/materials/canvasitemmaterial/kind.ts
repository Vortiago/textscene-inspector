import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import { ShaderMode, shaderModeOf } from '../../../godot/rendering/shaderLanguage';
import type { Follow, ResourceKind } from '../../reading';
import { decodeShaderText } from '../shadermaterial/decode';
import type { ShaderText } from '../shadermaterial/types';
import { canvasItemMaterialOf } from './decode';
import type { CanvasItemMaterialProperties } from './types';

/** A canvas item's material: a CanvasItemMaterial's properties or a canvas_item shader, at most one. */
export interface CanvasItemMaterialSlot {
  readonly properties: CanvasItemMaterialProperties | null;
  readonly shader: ShaderText | null;
}

/** A Material of no type a canvas item draws: plain canvas blending. */
export const NO_MATERIAL: CanvasItemMaterialSlot = Object.freeze({ properties: null, shader: null });

export const CANVAS_ITEM_MATERIAL: ResourceKind<CanvasItemMaterialSlot> = {
  name: 'CanvasItemMaterial',
  accepts: (type) => descendsFromClass(type, 'Material'),
  decode: ({ type, properties }, follow) =>
    type === 'ShaderMaterial'
      ? canvasShaderSlot(properties, follow)
      : { properties: canvasItemMaterialOf({ type, data: properties }), shader: null },
};

/** A ShaderMaterial of `shader_type canvas_item`, or no material for any other shader or none. */
function canvasShaderSlot(
  properties: Readonly<Record<string, string>>,
  follow: Follow
): CanvasItemMaterialSlot {
  const shader = decodeShaderText(properties, follow);
  // A slot of its own, not NO_MATERIAL: a tile layer splits its canvas items by material identity.
  if (!shader || shaderModeOf(shader.code) !== ShaderMode.CANVAS_ITEM)
    return { properties: null, shader: null };
  return { properties: null, shader };
}
