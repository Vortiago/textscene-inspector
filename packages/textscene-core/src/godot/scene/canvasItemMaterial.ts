/** Godot 4.6.3's CanvasItemMaterial facts a scene's properties carry. */

/** `canvas_item_material.h:39-46`: DISABLED is in no hint (cpp:260), yet Godot draws a stored 5 opaque. */
export const CanvasItemMaterialBlendMode = {
  MIX: 0,
  ADD: 1,
  SUB: 2,
  MUL: 3,
  PREMULT_ALPHA: 4,
  DISABLED: 5,
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
