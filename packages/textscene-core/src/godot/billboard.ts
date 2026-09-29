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
