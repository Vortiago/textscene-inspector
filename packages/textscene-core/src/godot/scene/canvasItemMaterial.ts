/** Godot 4.6.3's CanvasItemMaterial facts a scene's properties carry. */

/**
 * `CanvasItemMaterial::BlendMode` (`scene/resources/canvas_item_material.h:39-46`), each member
 * without `BLEND_MODE_`. `BLEND_MODE_DISABLED` (5) is left out: it is bound to no script API and
 * the `blend_mode` hint lists five entries (`canvas_item_material.cpp:260`), so no scene authors it.
 */
export const CanvasItemMaterialBlendMode = {
  MIX: 0,
  ADD: 1,
  SUB: 2,
  MUL: 3,
  PREMULT_ALPHA: 4,
} as const;

/**
 * `CanvasItemMaterial::LightMode` (`canvas_item_material.h:48-52`), each member without
 * `LIGHT_MODE_`. NORMAL is lit by 2D lights, UNSHADED is drawn at full albedo untouched by any
 * light, and LIGHT_ONLY is drawn only where a light reaches it.
 */
export const CanvasItemMaterialLightMode = {
  NORMAL: 0,
  UNSHADED: 1,
  LIGHT_ONLY: 2,
} as const;
