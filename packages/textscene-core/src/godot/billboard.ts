/**
 * `BaseMaterial3D::BillboardMode` (`scene/resources/material.h:300-306`), as the integers a
 * `.tscn` stores for `billboard_mode` (`material.cpp:3740`). Sprite3D and Label3D share the
 * first three through `SpriteBase3D`, which refuses PARTICLES.
 */
export const BillboardMode = {
  DISABLED: 0,
  ENABLED: 1,
  FIXED_Y: 2,
  PARTICLES: 3,
} as const;
