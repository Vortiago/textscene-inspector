/** The billboard modes a BaseMaterial3D, a Sprite3D and a Label3D turn to face the camera with. */

import { enumNamesByValue, relabelEnumNames } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::BillboardMode` (`scene/resources/material.h:300-306`), in Godot's own
 * member names, as the integers a `.tscn` stores for `billboard_mode` (`material.cpp:3740`).
 * Sprite3D and Label3D read the same enum through `SpriteBase3D`, which refuses PARTICLES.
 */
export const BillboardMode = {
  BILLBOARD_DISABLED: 0,
  BILLBOARD_ENABLED: 1,
  BILLBOARD_FIXED_Y: 2,
  BILLBOARD_PARTICLES: 3,
} as const;

/** Each billboard mode's name without its `BILLBOARD_` prefix, as the validators print it. */
export const BILLBOARD_MODE_NAMES = relabelEnumNames(enumNamesByValue(BillboardMode), (name) =>
  name.replace(/^BILLBOARD_/, '')
);
