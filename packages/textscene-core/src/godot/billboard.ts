/**
 * `BaseMaterial3D::BillboardMode` (`scene/resources/material.h:300-306`), in Godot's own
 * member names, as the integers a `.tscn` stores for `billboard_mode` (`material.cpp:3740`).
 * Sprite3D and Label3D read the same enum through `SpriteBase3D`, which refuses PARTICLES.
 */
export enum BillboardMode {
  BILLBOARD_DISABLED = 0,
  BILLBOARD_ENABLED = 1,
  BILLBOARD_FIXED_Y = 2,
  BILLBOARD_PARTICLES = 3,
}

/**
 * The centre of a SpriteBase3D's or Label3D's AABB under its billboard mode, from the centre of
 * the unturned box. ENABLED grows the box to a cube about the origin, and FIXED_Y to a prism
 * about the Y axis that keeps its height (`sprite_3d.cpp:252-273`, `label_3d.cpp:624-642`).
 */
export function billboardAabbCentre(
  centre: { x: number; y: number; z: number },
  mode: number
): { x: number; y: number; z: number } {
  switch (mode) {
    case BillboardMode.BILLBOARD_ENABLED:
      return { x: 0, y: 0, z: 0 };
    case BillboardMode.BILLBOARD_FIXED_Y:
      return { x: 0, y: centre.y, z: 0 };
    default:
      return centre;
  }
}
